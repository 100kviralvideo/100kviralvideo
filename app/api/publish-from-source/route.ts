import { NextRequest, NextResponse } from "next/server";
import { uploadVideoFromUrlToDrive } from "@/lib/googleDriveOAuth";
import { uploadYouTubeShort } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 60;

type PlatformTarget = {
  platform: "youtube_shorts" | "instagram_reels" | "tiktok";
  account_id?: string;
  privacy?: "private" | "public" | "unlisted";
  publish_at?: string;
};

type PublishFromSourcePayload = {
  job_id: string;
  source_video_url: string;
  video_filename?: string;
  drive_folder_id?: string;
  title: string;
  caption: string;
  description?: string;
  hashtags?: string[];
  duration_sec?: number;
  human_approved: boolean;
  rights_cleared: boolean;
  ai_generated?: boolean;
  platforms: PlatformTarget[];
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.PUBLISHER_API_KEY}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as PublishFromSourcePayload;

  if (!payload.human_approved) {
    return NextResponse.json(
      { error: "Human approval is required" },
      { status: 400 }
    );
  }

  if (!payload.rights_cleared) {
    return NextResponse.json(
      { error: "Rights clearance is required" },
      { status: 400 }
    );
  }

  if (!payload.source_video_url) {
    return NextResponse.json(
      { error: "source_video_url is required" },
      { status: 400 }
    );
  }

  const videoFilename =
    payload.video_filename || `${payload.job_id}_final.mp4`;

  try {
    const driveUpload = await uploadVideoFromUrlToDrive({
      sourceVideoUrl: payload.source_video_url,
      videoFilename,
      folderId: payload.drive_folder_id,
    });

    const results = [];

    for (const target of payload.platforms) {
      try {
        if (target.platform === "youtube_shorts") {
          const youtubeResult = await uploadYouTubeShort({
            finalVideoUrl: driveUpload.final_video_url,
            title: payload.title,
            caption: payload.caption,
            description: payload.description,
            hashtags: payload.hashtags ?? [],
            privacy: target.privacy ?? "private",
            publishAt: target.publish_at,
            aiGenerated: payload.ai_generated ?? true,
          });

          results.push({
            platform: "youtube_shorts",
            status: "published_or_scheduled",
            ...youtubeResult,
          });
        }

        if (target.platform === "instagram_reels") {
          results.push({
            platform: "instagram_reels",
            status: "not_implemented_here",
            note: "For Reels, prefer Supabase/R2 public MP4 URL instead of Google Drive.",
          });
        }

        if (target.platform === "tiktok") {
          results.push({
            platform: "tiktok",
            status: "needs_manual_action",
          });
        }
      } catch (error: any) {
        results.push({
          platform: target.platform,
          status: "failed",
          error: error.message ?? "Unknown platform publish error",
        });
      }
    }

    return NextResponse.json({
      job_id: payload.job_id,
      status: "processed",
      storage: driveUpload,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        job_id: payload.job_id,
        status: "failed",
        error: error.message ?? "Unknown backend error",
      },
      { status: 500 }
    );
  }
}