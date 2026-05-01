import { mkdir, readFile, readdir, writeFile } from "fs/promises";
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
  caption?: string;
  description?: string;
  hashtags?: string[];
  duration_sec?: number;
  segment_lengths?: number[];
  fps?: number;
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
  return path.join(settings.jobsDir, `${encodeURIComponent(jobId)}.json`);
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

function isComfyJobRecord(value: unknown): value is ComfyJobRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { job_id?: unknown }).job_id === "string" &&
    typeof (value as { status?: unknown }).status === "string" &&
    typeof (value as { created_at?: unknown }).created_at === "string" &&
    typeof (value as { updated_at?: unknown }).updated_at === "string"
  );
}

async function loadAllJobs() {
  const settings = getComfyStorageSettings();

  try {
    const entries = await readdir(settings.jobsDir, { withFileTypes: true });
    const loadedJobs = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          try {
            const raw = await readFile(path.join(settings.jobsDir, entry.name), "utf8");
            const parsed = JSON.parse(raw) as unknown;
            return isComfyJobRecord(parsed) ? parsed : null;
          } catch {
            return null;
          }
        })
    );

    return loadedJobs.filter((job): job is ComfyJobRecord => job !== null);
  } catch {
    return [];
  }
}

export async function createComfyJob(
  jobId: string,
  metadata: Partial<
    Pick<
      ComfyJobRecord,
      | "title"
      | "caption"
      | "description"
      | "hashtags"
      | "duration_sec"
      | "segment_lengths"
      | "fps"
    >
  > = {}
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

export async function findComfyJobByTitle(title: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    return null;
  }

  const cached = Array.from(jobs.values()).filter(
    (job) => job.title === normalizedTitle
  );
  const persisted = await loadAllJobs();
  const candidates = [...cached, ...persisted]
    .filter((job) => job.title === normalizedTitle)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return candidates[0] ?? null;
}
