import { NextRequest, NextResponse } from "next/server";
import {
  getLatestPrePublishItem,
  updatePrePublishStatus,
} from "@/lib/prepublish-queue";
import { isRecord, processPublishPayload, PublishPayload } from "@/lib/publisher";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    await updatePrePublishStatus(jobId, { status: "publishing" });

    const privacy = typeof body.privacy === "string" ? body.privacy : undefined;
    const platforms = current.item.platforms.map((target) => {
      if (!privacy) return target;
      if (target.platform === "youtube_shorts") {
        return { ...target, privacy: privacy as any };
      }
      return { 
        ...target, 
        privacy_level: privacy === "private" ? "SELF_ONLY" : "EVERYONE" 
      };
    });

    const publishPayload: PublishPayload = {
      job_id: current.item.job_id,
      final_video_url: current.item.final_video_url,
      title: current.item.title,
      caption: current.item.caption,
      description: current.item.description,
      hashtags: current.item.hashtags,
      duration_sec: current.item.duration_sec,
      human_approved: true,
      rights_cleared: true,
      ai_generated: current.item.ai_generated,
      platforms: platforms,
    };
    const publishResult = await processPublishPayload(publishPayload);

    await updatePrePublishStatus(jobId, {
      status: "published",
      publish_result: publishResult,
    });

    return NextResponse.json({
      success: true,
      job_id: jobId,
      status: "published",
      publish: publishResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    try {
      await updatePrePublishStatus(jobId, {
        status: "failed",
        error: message,
      });
    } catch {
      // The primary error is more useful for the caller.
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
