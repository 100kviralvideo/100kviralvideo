import { NextResponse } from "next/server";
import { findDriveVideo } from "@/lib/drive-video";
import { getReviewQueue } from "@/lib/review-queue";

export const runtime = "nodejs";

export async function GET() {
  try {
    const queue = getReviewQueue();
    const readyClips = [];

    for (const item of queue) {
      const driveVideo = await findDriveVideo({
        folderId: item.folder_id,
        videoFilename: item.video_filename,
      });

      if (!driveVideo) {
        continue;
      }

      readyClips.push({
        id: item.id,
        title: item.title,
        caption: item.caption,
        description: item.description,
        hashtags: item.hashtags,
        duration_sec: item.duration_sec,
        ai_generated: item.ai_generated,
        platforms: item.platforms,
        drive_video: driveVideo,
      });
    }

    return NextResponse.json({
      configured: queue.length > 0,
      clips: readyClips,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load review queue";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
