import { NextRequest, NextResponse } from "next/server";
import {
  getLatestPrePublishItem,
  updatePrePublishStatus,
} from "@/lib/prepublish-queue";
import { isRecord } from "@/lib/publisher";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.job_id !== "string" ||
    !body.job_id.trim()
  ) {
    return NextResponse.json(
      { error: "job_id is required" },
      { status: 400 }
    );
  }

  const jobId = body.job_id.trim();

  try {
    const current = await getLatestPrePublishItem(jobId);

    if (!current) {
      return NextResponse.json(
        { error: `No pre-publish queue item found for job_id "${jobId}"` },
        { status: 404 }
      );
    }

    if (current.item.status !== "pending") {
      return NextResponse.json(
        {
          error: `Job "${jobId}" is not pending approval`,
          status: current.item.status,
        },
        { status: 409 }
      );
    }

    await updatePrePublishStatus(jobId, { 
      status: "failed", 
      error: "Denied by user" 
    });

    return NextResponse.json({
      success: true,
      job_id: jobId,
      status: "failed",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
