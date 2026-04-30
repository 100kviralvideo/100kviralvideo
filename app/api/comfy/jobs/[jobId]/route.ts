import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { createComfyJob, getComfyJob, updateComfyJob } from "@/lib/comfy/jobs";
import { refreshComfyVideoJob } from "@/lib/comfy/processor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  if (!validatePublisherAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  let job = await getComfyJob(jobId);

  if (!job) {
    const promptId = req.nextUrl.searchParams.get("prompt_id")?.trim();

    if (!promptId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const title = req.nextUrl.searchParams.get("title")?.trim() || undefined;
    await createComfyJob(jobId, { title });
    job = await updateComfyJob(jobId, {
      status: "processing",
      prompt_id: promptId,
    });
  }

  const refreshedJob = await refreshComfyVideoJob(job);
  return NextResponse.json(refreshedJob);
}
