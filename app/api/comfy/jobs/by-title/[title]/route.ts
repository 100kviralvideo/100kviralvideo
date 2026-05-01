import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { findComfyJobByTitle } from "@/lib/comfy/jobs";
import { refreshComfyVideoJob } from "@/lib/comfy/processor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ title: string }> }
) {
  if (!validatePublisherAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title } = await context.params;
  const job = await findComfyJobByTitle(title);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const refreshedJob = await refreshComfyVideoJob(job);
  return NextResponse.json(refreshedJob);
}
