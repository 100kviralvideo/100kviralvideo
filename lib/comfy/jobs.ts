import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getComfyStorageSettings } from "@/lib/comfy/settings";

export type ComfyJobStatus =
  | "queued"
  | "uploading_images_to_comfy"
  | "loading_workflow"
  | "queued_in_comfy"
  | "processing"
  | "reading_output"
  | "done"
  | "failed";

export type ComfyJobRecord = {
  job_id: string;
  status: ComfyJobStatus;
  title?: string;
  prompt_id?: string;
  comfy_client_id?: string;
  output_file_name?: string;
  output_file_subfolder?: string;
  output_file_type?: string;
  error?: string;
  created_at: string;
  updated_at: string;
};

const jobs = new Map<string, ComfyJobRecord>();

function getJobRecordPath(jobId: string) {
  const settings = getComfyStorageSettings();
  return path.join(settings.jobsDir, `${jobId}.json`);
}

async function saveJob(job: ComfyJobRecord) {
  const filePath = getJobRecordPath(job.job_id);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(job, null, 2));
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
    return null;
  }
}

export async function createComfyJob(
  jobId: string,
  metadata: Pick<ComfyJobRecord, "title"> = {}
) {
  const now = new Date().toISOString();
  const job: ComfyJobRecord = {
    job_id: jobId,
    status: "queued",
    ...metadata,
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
