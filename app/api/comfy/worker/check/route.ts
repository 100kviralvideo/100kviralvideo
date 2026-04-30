import { NextRequest, NextResponse } from "next/server";
import { createComfyJob, getComfyJob, updateComfyJob } from "@/lib/comfy/jobs";
import { refreshComfyVideoJob } from "@/lib/comfy/processor";
import {
  scheduleComfyCompletionCheck,
  type ComfyCompletionCheckPayload,
} from "@/lib/comfy/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(value: unknown): ComfyCompletionCheckPayload {
  if (!isRecord(value)) {
    throw new Error("Worker payload must be a JSON object");
  }

  const jobId = value.job_id;
  const promptId = value.prompt_id;

  if (typeof jobId !== "string" || !jobId.trim()) {
    throw new Error("job_id is required");
  }

  if (typeof promptId !== "string" || !promptId.trim()) {
    throw new Error("prompt_id is required");
  }

  return {
    job_id: jobId.trim(),
    prompt_id: promptId.trim(),
    comfy_client_id:
      typeof value.comfy_client_id === "string"
        ? value.comfy_client_id.trim() || undefined
        : undefined,
    title:
      typeof value.title === "string" ? value.title.trim() || undefined : undefined,
    attempt:
      typeof value.attempt === "number" && Number.isFinite(value.attempt)
        ? value.attempt
        : 1,
    secret: typeof value.secret === "string" ? value.secret : undefined,
  };
}

export async function POST(req: NextRequest) {
  let payload: ComfyCompletionCheckPayload;

  try {
    payload = parsePayload(await req.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 }
    );
  }

  if (!process.env.COMFY_WORKER_SECRET?.trim()) {
    return NextResponse.json(
      { error: "COMFY_WORKER_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (payload.secret !== process.env.COMFY_WORKER_SECRET.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let job = await getComfyJob(payload.job_id);

  if (!job) {
    await createComfyJob(payload.job_id, { title: payload.title });
    job = await updateComfyJob(payload.job_id, {
      status: "processing",
      prompt_id: payload.prompt_id,
      comfy_client_id: payload.comfy_client_id,
    });
  } else if (!job.prompt_id) {
    job = await updateComfyJob(payload.job_id, {
      status: "processing",
      prompt_id: payload.prompt_id,
      comfy_client_id: payload.comfy_client_id,
      title: payload.title || job.title,
    });
  }

  const refreshedJob = await refreshComfyVideoJob(job);

  if (refreshedJob?.status === "processing") {
    const nextAttempt = (payload.attempt || 1) + 1;

    if (nextAttempt <= 60) {
      await scheduleComfyCompletionCheck(
        {
          job_id: payload.job_id,
          prompt_id: payload.prompt_id,
          comfy_client_id: payload.comfy_client_id,
          title: payload.title,
          attempt: nextAttempt,
        },
        "1m"
      );
    }
  }

  return NextResponse.json({
    ok: true,
    job: refreshedJob,
  });
}
