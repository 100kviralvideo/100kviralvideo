import { NextRequest, NextResponse } from "next/server";
import { findDriveVideo } from "@/lib/drive-video";
import { getReviewQueueItem } from "@/lib/review-queue";

export const runtime = "nodejs";
export const maxDuration = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const item = getReviewQueueItem(body.id);

  if (!item) {
    return NextResponse.json(
      { error: "Review queue item was not found" },
      { status: 404 }
    );
  }

  const driveVideo = await findDriveVideo({
    folderId: item.folder_id,
    videoFilename: item.video_filename,
  });

  if (!driveVideo) {
    return NextResponse.json(
      { error: "Video is not ready in Google Drive yet" },
      { status: 409 }
    );
  }

  const publisherApiKey = process.env.PUBLISHER_API_KEY?.trim();

  if (!publisherApiKey) {
    return NextResponse.json(
      { error: "PUBLISHER_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const publishResponse = await fetch(new URL("/api/publish", req.url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publisherApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id: item.id,
      final_video_url: driveVideo.final_video_url,
      title: item.title,
      caption: item.caption,
      description: item.description,
      hashtags: item.hashtags,
      duration_sec: item.duration_sec,
      human_approved: true,
      rights_cleared: true,
      ai_generated: item.ai_generated,
      platforms: item.platforms,
    }),
  });
  const publishResult = await publishResponse.json();

  return NextResponse.json(publishResult, {
    status: publishResponse.status,
  });
}
