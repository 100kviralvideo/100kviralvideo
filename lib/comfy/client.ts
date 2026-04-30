import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ComfyWorkflow } from "@/lib/comfy/workflow";

type ComfyOutputFile = {
  filename: string;
  subfolder?: string;
  type?: string;
};

type ComfyHistoryItem = {
  outputs?: Record<string, Record<string, unknown>>;
  status?: {
    status_str?: string;
    [key: string]: unknown;
  };
};

function assertOk(response: Response, context: string) {
  if (!response.ok) {
    throw new Error(`${context} failed: ${response.status} ${response.statusText}`);
  }
}

export class ComfyClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 60_000
  ) {}

  private async fetchWithTimeout(input: string, init?: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async uploadImage(localPath: string, overwrite = true) {
    const buffer = await readFile(localPath);
    const form = new FormData();

    form.append(
      "image",
      new Blob([new Uint8Array(buffer)], { type: "image/png" }),
      path.basename(localPath)
    );
    form.append("overwrite", overwrite ? "true" : "false");

    const response = await this.fetchWithTimeout(`${this.baseUrl}/upload/image`, {
      method: "POST",
      body: form,
    });
    assertOk(response, "ComfyUI image upload");

    const data = (await response.json()) as { name?: string };

    if (!data.name) {
      throw new Error(`ComfyUI image upload did not return a name: ${JSON.stringify(data)}`);
    }

    return data.name;
  }

  async queuePrompt(workflow: ComfyWorkflow) {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt: workflow,
        client_id: crypto.randomUUID(),
      }),
    });
    assertOk(response, "ComfyUI prompt queue");

    const data = (await response.json()) as { prompt_id?: string };

    if (!data.prompt_id) {
      throw new Error(`ComfyUI did not return prompt_id: ${JSON.stringify(data)}`);
    }

    return data.prompt_id;
  }

  async getHistory(promptId: string) {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/history/${promptId}`
    );
    assertOk(response, "ComfyUI history request");

    return (await response.json()) as Record<string, ComfyHistoryItem>;
  }

  async waitForCompletion({
    promptId,
    pollIntervalSeconds,
    timeoutSeconds,
  }: {
    promptId: string;
    pollIntervalSeconds: number;
    timeoutSeconds: number;
  }) {
    const started = Date.now();

    while (true) {
      const history = await this.getHistory(promptId);
      const item = history[promptId];

      if (item) {
        if (item.status?.status_str === "error") {
          throw new Error(`ComfyUI workflow failed: ${JSON.stringify(item.status)}`);
        }

        return item;
      }

      if (Date.now() - started > timeoutSeconds * 1000) {
        throw new Error(`Timed out waiting for ComfyUI prompt_id=${promptId}`);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, pollIntervalSeconds * 1000)
      );
    }
  }

  async downloadFile(fileInfo: ComfyOutputFile, savePath: string) {
    const params = new URLSearchParams({
      filename: fileInfo.filename,
      subfolder: fileInfo.subfolder || "",
      type: fileInfo.type || "output",
    });
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/view?${params.toString()}`
    );
    assertOk(response, "ComfyUI output download");

    if (!response.body) {
      throw new Error("ComfyUI output download returned an empty body");
    }

    await pipeline(
      Readable.fromWeb(
        response.body as unknown as Parameters<typeof Readable.fromWeb>[0]
      ),
      createWriteStream(savePath)
    );

    return savePath;
  }
}

function getOutputFiles(nodeOutput: Record<string, unknown>) {
  const preferredKeys = ["videos", "gifs", "files"];
  const files: ComfyOutputFile[] = [];

  for (const key of preferredKeys) {
    const values = nodeOutput[key];

    if (!Array.isArray(values)) {
      continue;
    }

    files.push(
      ...values.filter(
        (value): value is ComfyOutputFile =>
          typeof value === "object" &&
          value !== null &&
          "filename" in value &&
          typeof value.filename === "string"
      )
    );
  }

  return files;
}

function pickVideoFile(files: ComfyOutputFile[]) {
  return (
    files.find((file) =>
      file.filename.toLowerCase().match(/\.(mp4|webm|mov|mkv)$/)
    ) || files[0]
  );
}

export function findOutputFile(
  historyItem: ComfyHistoryItem,
  preferredNodeId?: string
): ComfyOutputFile {
  const outputs = historyItem.outputs || {};

  if (preferredNodeId && outputs[preferredNodeId]) {
    const preferredOutput = pickVideoFile(getOutputFiles(outputs[preferredNodeId]));

    if (preferredOutput) {
      return preferredOutput;
    }
  }

  for (const nodeOutput of Object.values(outputs)) {
    const output = pickVideoFile(getOutputFiles(nodeOutput));

    if (output) {
      return output;
    }
  }

  throw new Error(
    "No output file found in ComfyUI history. Inspect /history/{prompt_id} and update output parsing."
  );
}
