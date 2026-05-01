import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ComfyClient, findOutputFile } from "@/lib/comfy/client";
import { updateComfyJob, type ComfyJobRecord } from "@/lib/comfy/jobs";
import {
  getComfySettings,
  getComfyStorageSettings,
} from "@/lib/comfy/settings";
import { buildWorkflow, loadWorkflowApi } from "@/lib/comfy/workflow";

export type ComfyGenerationOptions = {
  width?: number;
  height?: number;
  fps?: number;
  segment_lengths?: number[];
  image_strength?: number;
};

export type ComfyProcessJobInput = {
  jobId: string;
  title?: string;
  globalPrompt: string;
  segmentPrompts: string[];
  imagePaths: string[];
  options?: ComfyGenerationOptions;
};

type QueuedComfyJobInput = ComfyProcessJobInput;

export async function createImagePaths(jobId: string) {
  const settings = getComfyStorageSettings();
  const jobDir = path.join(settings.jobsDir, encodeURIComponent(jobId));

  await mkdir(jobDir, { recursive: true });

  return ["segment-1.png", "segment-2.png", "segment-3.png", "segment-4.png"].map(
    (fileName) => path.join(jobDir, fileName)
  );
}

export async function saveUploadedImage(file: File, savePath: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  assertSupportedImageBuffer(buffer, file.name || savePath);
  await writeFile(savePath, buffer);
}

export async function downloadImage(url: string, savePath: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  assertSupportedImageBuffer(buffer, url);
  await writeFile(savePath, buffer);
}

function assertSupportedImageBuffer(buffer: Buffer, source: string) {
  const isPng = buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  if (!isPng && !isJpeg && !isWebp) {
    throw new Error(
      `${source} is not a valid PNG, JPEG, or WEBP image. Check that the image URL is a direct image file, not an HTML page.`
    );
  }
}

export async function processComfyVideoJob({
  jobId,
  title,
  globalPrompt,
  segmentPrompts,
  imagePaths,
  options = {},
}: ComfyProcessJobInput) {
  const queuedJob = await queueComfyVideoJob({
    jobId,
    title,
    globalPrompt,
    segmentPrompts,
    imagePaths,
    options,
  });

  if (!queuedJob.prompt_id) {
    throw new Error("Comfy job did not return prompt_id after queueing");
  }

  await waitForQueuedComfyVideoJob({
    jobId,
    promptId: queuedJob.prompt_id,
    clientId: queuedJob.comfy_client_id,
  });
}

export async function queueComfyVideoJob({
  jobId,
  title,
  globalPrompt,
  segmentPrompts,
  imagePaths,
  options = {},
}: QueuedComfyJobInput) {
  const settings = getComfySettings();

  try {
    const comfy = new ComfyClient(settings.comfyUrl);

    await updateComfyJob(jobId, { status: "uploading_images_to_comfy" });
    const imageNames = await Promise.all(
      imagePaths.map((imagePath) => comfy.uploadImage(imagePath))
    );

    await updateComfyJob(jobId, { status: "loading_workflow" });
    const baseWorkflow = await loadWorkflowApi(settings.workflowPath);
    const workflow = buildWorkflow({
      baseWorkflow,
      imageNodeIds: settings.imageNodeIds,
      imageNames,
      promptRelayNodeId: settings.promptRelayNodeId,
      globalPrompt,
      segmentPrompts,
      widthNodeId: settings.widthNodeId,
      heightNodeId: settings.heightNodeId,
      fpsNodeId: settings.fpsNodeId,
      segmentLengthNodeIds: settings.segmentLengthNodeIds,
      imageStrengthNodeId: settings.imageStrengthNodeId,
      outputNodeId: settings.outputNodeId,
      outputJobId: jobId,
      width: options.width,
      height: options.height,
      fps: options.fps,
      segmentLengths: options.segment_lengths,
      imageStrength: options.image_strength,
      outputTitle: title,
    });

    await updateComfyJob(jobId, { status: "queued_in_comfy" });
    const queuedPrompt = await comfy.queuePrompt(workflow);
    return updateComfyJob(jobId, {
      status: "processing",
      prompt_id: queuedPrompt.promptId,
      comfy_client_id: queuedPrompt.clientId,
    });
  } catch (error) {
    await updateComfyJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown ComfyUI error",
    });
    throw error;
  }
}

export async function waitForQueuedComfyVideoJob({
  jobId,
  promptId,
  clientId,
}: {
  jobId: string;
  promptId: string;
  clientId?: string;
}) {
  const settings = getComfySettings();

  try {
    const comfy = new ComfyClient(settings.comfyUrl);
    const historyItem = await comfy.waitForCompletion({
      promptId,
      clientId,
      pollIntervalSeconds: settings.pollIntervalSeconds,
      timeoutSeconds: settings.jobTimeoutSeconds,
    });
    await finalizeComfyVideoJob(jobId, historyItem);
  } catch (error) {
    await updateComfyJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown ComfyUI error",
    });
  }
}

async function finalizeComfyVideoJob(jobId: string, historyItem: Parameters<typeof findOutputFile>[0]) {
  await updateComfyJob(jobId, { status: "reading_output" });
  const settings = getComfySettings();
  const outputInfo = findOutputFile(historyItem, settings.outputNodeId);

  return updateComfyJob(jobId, {
    status: "done",
    output_file_name: outputInfo.filename,
    output_file_subfolder: outputInfo.subfolder,
    output_file_type: outputInfo.type,
  });
}

export async function refreshComfyVideoJob(job: ComfyJobRecord) {
  if (
    job.status === "done" ||
    job.status === "failed" ||
    !job.prompt_id
  ) {
    return job;
  }

  const settings = getComfySettings();
  const comfy = new ComfyClient(settings.comfyUrl);

  try {
    const history = await comfy.getHistory(job.prompt_id);
    const historyItem = history[job.prompt_id];

    if (!historyItem) {
      return updateComfyJob(job.job_id, { status: "processing" });
    }

    if (historyItem.status?.status_str === "error") {
      return updateComfyJob(job.job_id, {
        status: "failed",
        error: `ComfyUI workflow failed: ${JSON.stringify(historyItem.status)}`,
      });
    }

    return finalizeComfyVideoJob(job.job_id, historyItem);
  } catch (error) {
    return updateComfyJob(job.job_id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown ComfyUI error",
    });
  }
}
