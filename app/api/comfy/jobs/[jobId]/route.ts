import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { getComfyJob } from "@/lib/comfy/jobs";
import { refreshComfyVideoJob } from "@/lib/comfy/processor";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  if (!validatePublisherAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await getComfyJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const refreshedJob = await refreshComfyVideoJob(job);
  return NextResponse.json(refreshedJob);
}
