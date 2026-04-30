import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { getComfyStorageSettings } from "@/lib/comfy/settings";
import {
  createGoogleDriveClient,
  escapeDriveQueryValue,
  isGoogleDriveConfigured,
} from "@/lib/google-drive";

export type ComfyJobStatus =
  | "queued"
  | "uploading_images_to_comfy"
  | "loading_workflow"
  | "queued_in_comfy"
  | "processing"
  | "downloading_output"
  | "output_downloaded"
  | "uploading_to_drive"
  | "done"
  | "failed";

export type ComfyJobRecord = {
  job_id: string;
  status: ComfyJobStatus;
  prompt_id?: string;
  drive_link?: string;
  final_video_url?: string;
  local_output_path?: string;
  error?: string;
  created_at: string;
  updated_at: string;
};

const jobs = new Map<string, ComfyJobRecord>();

function getJobRecordPath(jobId: string) {
  const settings = getComfyStorageSettings();
  return path.join(settings.jobsDir, `${jobId}.json`);
}

function getDriveJobFileName(jobId: string) {
  return `comfy-job-${jobId}.json`;
}

function isDriveJobStoreConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() && isGoogleDriveConfigured()
  );
}

async function findDriveJobFileId(jobId: string) {
  if (!isDriveJobStoreConfigured()) {
    return null;
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!.trim();
  const fileName = getDriveJobFileName(jobId);
  const drive = createGoogleDriveClient();
  const response = await drive.files.list({
    q: [
      `'${escapeDriveQueryValue(folderId)}' in parents`,
      `name = '${escapeDriveQueryValue(fileName)}'`,
      "trashed = false",
    ].join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files?.[0]?.id || null;
}

async function saveDriveJob(job: ComfyJobRecord) {
  if (!isDriveJobStoreConfigured()) {
    return;
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!.trim();
  const drive = createGoogleDriveClient();
  const fileName = getDriveJobFileName(job.job_id);
  const body = Readable.from([JSON.stringify(job, null, 2)]);
  const existingFileId = await findDriveJobFileId(job.job_id);

  if (existingFileId) {
    await drive.files.update({
      fileId: existingFileId,
      media: {
        mimeType: "application/json",
        body,
      },
      supportsAllDrives: true,
    });
    return;
  }

  await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/json",
    },
    media: {
      mimeType: "application/json",
      body,
    },
    fields: "id",
    supportsAllDrives: true,
  });
}

async function loadDriveJob(jobId: string) {
  const fileId = await findDriveJobFileId(jobId);

  if (!fileId) {
    return null;
  }

  const drive = createGoogleDriveClient();
  const response = await drive.files.get(
    {
      fileId,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "text" }
  );
  const job = JSON.parse(String(response.data)) as ComfyJobRecord;
  jobs.set(jobId, job);
  return job;
}

async function saveJob(job: ComfyJobRecord) {
  const filePath = getJobRecordPath(job.job_id);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(job, null, 2));
  await saveDriveJob(job);
  jobs.set(job.job_id, job);
}

async function loadJob(jobId: string) {
  const cached = jobs.get(jobId);

  if (cached) {
    return cached;
  }

  try {
    const raw = await readFile(getJobRecordPath(jobId), "utf8");
    const job = JSON.parse(raw) as ComfyJobRecord;
    jobs.set(jobId, job);
    return job;
  } catch {
    return loadDriveJob(jobId);
  }
}

export async function createComfyJob(jobId: string) {
  const now = new Date().toISOString();
  const job: ComfyJobRecord = {
    job_id: jobId,
    status: "queued",
    created_at: now,
    updated_at: now,
  };

  await saveJob(job);
  return job;
}

export async function updateComfyJob(
  jobId: string,
  patch: Partial<Omit<ComfyJobRecord, "job_id" | "created_at">>
) {
  const job = await loadJob(jobId);

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const updated = {
    ...job,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  await saveJob(updated);
  return updated;
}

export async function getComfyJob(jobId: string) {
  return loadJob(jobId);
}
