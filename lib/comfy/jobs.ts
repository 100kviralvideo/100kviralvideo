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

export function createComfyJob(jobId: string) {
  const now = new Date().toISOString();
  const job: ComfyJobRecord = {
    job_id: jobId,
    status: "queued",
    created_at: now,
    updated_at: now,
  };

  jobs.set(jobId, job);
  return job;
}

export function updateComfyJob(
  jobId: string,
  patch: Partial<Omit<ComfyJobRecord, "job_id" | "created_at">>
) {
  const job = jobs.get(jobId);

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const updated = {
    ...job,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  jobs.set(jobId, updated);
  return updated;
}

export function getComfyJob(jobId: string) {
  return jobs.get(jobId) || null;
}
