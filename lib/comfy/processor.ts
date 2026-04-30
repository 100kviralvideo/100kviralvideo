import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ComfyClient, findOutputFile } from "@/lib/comfy/client";
import { updateComfyJob } from "@/lib/comfy/jobs";
import {
  getComfySettings,
  getComfyStorageSettings,
} from "@/lib/comfy/settings";
import { buildWorkflow, loadWorkflowApi } from "@/lib/comfy/workflow";
import { uploadVideoToDrive } from "@/lib/google-drive";

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
  await writeFile(savePath, buffer);
}

export async function downloadImage(url: string, savePath: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(savePath, buffer);
}

export async function processComfyVideoJob({
  jobId,
  globalPrompt,
  segmentPrompts,
  imagePaths,
  options = {},
}: ComfyProcessJobInput) {
  const settings = getComfySettings();

  try {
    const comfy = new ComfyClient(settings.comfyUrl);

    updateComfyJob(jobId, { status: "uploading_images_to_comfy" });
    const imageNames = await Promise.all(
      imagePaths.map((imagePath) => comfy.uploadImage(imagePath))
    );

    updateComfyJob(jobId, { status: "loading_workflow" });
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

    updateComfyJob(jobId, { status: "queued_in_comfy" });
    const promptId = await comfy.queuePrompt(workflow);
    updateComfyJob(jobId, { status: "processing", prompt_id: promptId });

    const historyItem = await comfy.waitForCompletion({
      promptId,
      pollIntervalSeconds: settings.pollIntervalSeconds,
      timeoutSeconds: settings.jobTimeoutSeconds,
    });

    updateComfyJob(jobId, { status: "downloading_output" });
    const outputInfo = findOutputFile(historyItem, settings.outputNodeId);
    const ext = path.extname(outputInfo.filename) || ".mp4";
    const outputDir = settings.outputDir;
    const localOutputPath = path.join(outputDir, `${jobId}${ext}`);

    await mkdir(outputDir, { recursive: true });
    await comfy.downloadFile(outputInfo, localOutputPath);
    updateComfyJob(jobId, {
      status: "output_downloaded",
      local_output_path: localOutputPath,
    });

    if (!settings.uploadToDrive) {
      updateComfyJob(jobId, {
        status: "done",
        local_output_path: localOutputPath,
      });
      return;
    }

    if (!settings.googleDriveFolderId) {
      throw new Error("GOOGLE_DRIVE_FOLDER_ID is required when UPLOAD_TO_DRIVE=true");
    }

    updateComfyJob(jobId, { status: "uploading_to_drive" });
    const upload = await uploadVideoToDrive({
      filePath: localOutputPath,
      folderId: settings.googleDriveFolderId,
      fileName: `${jobId}${ext}`,
      makePublic: settings.googleDrivePublic,
    });

    updateComfyJob(jobId, {
      status: "done",
      drive_link: upload.drive_link,
      final_video_url: upload.final_video_url,
      local_output_path: localOutputPath,
    });
  } catch (error) {
    updateComfyJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown ComfyUI error",
    });
  }
}
