import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ComfyClient, findOutputFile } from "@/lib/comfy/client";
import {
  getComfyJob,
  updateComfyJob,
  type ComfyJobRecord,
} from "@/lib/comfy/jobs";
import {
  getComfySettings,
  getComfyStorageSettings,
} from "@/lib/comfy/settings";
import { buildWorkflow, loadWorkflowApi } from "@/lib/comfy/workflow";
import { isGoogleDriveConfigured, uploadVideoToDrive } from "@/lib/google-drive";

export type ComfyGenerationOptions = {
  width?: number;
  height?: number;
  fps?: number;
  segment_lengths?: number[];
  image_strength?: number;
};

export type ComfyProcessJobInput = {
  jobId: string;
  globalPrompt: string;
  segmentPrompts: string[];
  imagePaths: string[];
  options?: ComfyGenerationOptions;
};

type QueuedComfyJobInput = ComfyProcessJobInput;

export async function createImagePaths(jobId: string) {
  const settings = getComfyStorageSettings();
  const jobDir = path.join(settings.jobsDir, jobId);

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

function assertDriveUploadConfigReady(settings: ReturnType<typeof getComfySettings>) {
  if (!settings.uploadToDrive) {
    return;
  }

  if (!settings.googleDriveFolderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is required when UPLOAD_TO_DRIVE=true");
  }

  if (!isGoogleDriveConfigured()) {
    throw new Error(
      "Google Drive credentials are required when UPLOAD_TO_DRIVE=true. Set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY, or configure Google Drive OAuth."
    );
  }
}

function sanitizeDriveFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function buildDriveVideoFileName({
  title,
  jobId,
  ext,
}: {
  title?: string;
  jobId: string;
  ext: string;
}) {
  const safeTitle = title ? sanitizeDriveFileName(title) : "";
  return `${safeTitle || jobId}${ext}`;
}

function normalizeNotifyUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

async function notifyVideoUploaded({
  job,
  driveLink,
  finalVideoUrl,
  fileName,
}: {
  job: ComfyJobRecord;
  driveLink: string;
  finalVideoUrl: string;
  fileName: string;
}) {
  const notifyUrl = normalizeNotifyUrl(job.notify_url);

  if (!notifyUrl) {
    return;
  }

  try {
    const response = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        event: "comfy_video_uploaded",
        status: "done",
        job_id: job.job_id,
        title: job.title || null,
        file_name: fileName,
        drive_link: driveLink,
        final_video_url: finalVideoUrl,
        local_output_path: job.local_output_path || null,
        uploaded_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    await updateComfyJob(job.job_id, {
      notification_sent_at: new Date().toISOString(),
      notification_error: undefined,
    });
  } catch (error) {
    await updateComfyJob(job.job_id, {
      notification_error:
        error instanceof Error ? error.message : "Unknown webhook error",
    });
  }
}

export async function processComfyVideoJob({
  jobId,
  globalPrompt,
  segmentPrompts,
  imagePaths,
  options = {},
}: ComfyProcessJobInput) {
  const queuedJob = await queueComfyVideoJob({
    jobId,
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
  });
}

export async function queueComfyVideoJob({
  jobId,
  globalPrompt,
  segmentPrompts,
  imagePaths,
  options = {},
}: QueuedComfyJobInput) {
  const settings = getComfySettings();
  assertDriveUploadConfigReady(settings);

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
      width: options.width,
      height: options.height,
      fps: options.fps,
      segmentLengths: options.segment_lengths,
      imageStrength: options.image_strength,
    });

    await updateComfyJob(jobId, { status: "queued_in_comfy" });
    const promptId = await comfy.queuePrompt(workflow);
    return updateComfyJob(jobId, { status: "processing", prompt_id: promptId });
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
}: {
  jobId: string;
  promptId: string;
}) {
  const settings = getComfySettings();

  try {
    const comfy = new ComfyClient(settings.comfyUrl);
    const historyItem = await comfy.waitForCompletion({
      promptId,
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
  const settings = getComfySettings();
  const comfy = new ComfyClient(settings.comfyUrl);
  const currentJob = await getComfyJob(jobId);

  await updateComfyJob(jobId, { status: "downloading_output" });
  const outputInfo = findOutputFile(historyItem, settings.outputNodeId);
  const ext = path.extname(outputInfo.filename) || ".mp4";
  const outputDir = settings.outputDir;
  const localOutputPath = path.join(outputDir, `${jobId}${ext}`);

  await mkdir(outputDir, { recursive: true });
  await comfy.downloadFile(outputInfo, localOutputPath);
  await updateComfyJob(jobId, {
    status: "output_downloaded",
    local_output_path: localOutputPath,
  });

  if (!settings.uploadToDrive) {
    return updateComfyJob(jobId, {
      status: "done",
      local_output_path: localOutputPath,
    });
  }

  if (!settings.googleDriveFolderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is required when UPLOAD_TO_DRIVE=true");
  }

  await updateComfyJob(jobId, { status: "uploading_to_drive" });
  const driveFileName = buildDriveVideoFileName({
    title: currentJob?.title,
    jobId,
    ext,
  });
  const upload = await uploadVideoToDrive({
    filePath: localOutputPath,
    folderId: settings.googleDriveFolderId,
    fileName: driveFileName,
    makePublic: settings.googleDrivePublic,
  });

  const updatedJob = await updateComfyJob(jobId, {
    status: "done",
    drive_link: upload.drive_link,
    final_video_url: upload.final_video_url,
    local_output_path: localOutputPath,
  });

  await notifyVideoUploaded({
    job: updatedJob,
    driveLink: upload.drive_link,
    finalVideoUrl: upload.final_video_url,
    fileName: driveFileName,
  });

  return getComfyJob(jobId);
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
