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

type ComfySocketMessage = {
  type?: string;
  data?: {
    node?: string | null;
    prompt_id?: string;
    exception_message?: string;
    exception_type?: string;
    [key: string]: unknown;
  };
};

function assertOk(response: Response, context: string) {
  if (!response.ok) {
    throw new Error(`${context} failed: ${response.status} ${response.statusText}`);
  }
}

function getComfyWebSocketUrl(baseUrl: string, clientId: string) {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = new URLSearchParams({ clientId }).toString();
  return url.toString();
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

  async queuePrompt(workflow: ComfyWorkflow, clientId = crypto.randomUUID()) {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
      }),
    });
    assertOk(response, "ComfyUI prompt queue");

    const data = (await response.json()) as { prompt_id?: string };

    if (!data.prompt_id) {
      throw new Error(`ComfyUI did not return prompt_id: ${JSON.stringify(data)}`);
    }

    return {
      promptId: data.prompt_id,
      clientId,
    };
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
    clientId,
    pollIntervalSeconds,
    timeoutSeconds,
  }: {
    promptId: string;
    clientId?: string;
    pollIntervalSeconds: number;
    timeoutSeconds: number;
  }) {
    if (clientId) {
      try {
        await this.waitForCompletionEvent({
          promptId,
          clientId,
          timeoutSeconds,
        });

        return this.waitForHistoryItem({
          promptId,
          pollIntervalSeconds,
          timeoutSeconds: 30,
        });
      } catch {
        return this.waitForHistoryItem({
          promptId,
          pollIntervalSeconds,
          timeoutSeconds,
        });
      }
    }

    return this.waitForHistoryItem({
      promptId,
      pollIntervalSeconds,
      timeoutSeconds,
    });
  }

  private async waitForCompletionEvent({
    promptId,
    clientId,
    timeoutSeconds,
  }: {
    promptId: string;
    clientId: string;
    timeoutSeconds: number;
  }) {
    const existingHistory = await this.getHistory(promptId);
    const existingItem = existingHistory[promptId];

    if (existingItem) {
      if (existingItem.status?.status_str === "error") {
        throw new Error(`ComfyUI workflow failed: ${JSON.stringify(existingItem.status)}`);
      }

      return;
    }

    const wsUrl = getComfyWebSocketUrl(this.baseUrl, clientId);

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error(`Timed out waiting for ComfyUI websocket prompt_id=${promptId}`));
      }, timeoutSeconds * 1000);

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        let message: ComfySocketMessage;

        try {
          message = JSON.parse(event.data) as ComfySocketMessage;
        } catch {
          return;
        }

        if (message.data?.prompt_id !== promptId) {
          return;
        }

        if (message.type === "execution_error") {
          clearTimeout(timeout);
          socket.close();
          reject(
            new Error(
              `ComfyUI workflow failed: ${
                message.data.exception_message ||
                message.data.exception_type ||
                JSON.stringify(message.data)
              }`
            )
          );
          return;
        }

        if (message.type === "executing" && message.data.node === null) {
          clearTimeout(timeout);
          socket.close();
          resolve();
        }
      });

      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        socket.close();
        reject(new Error("ComfyUI websocket connection failed"));
      });
    });
  }

  private async waitForHistoryItem({
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
