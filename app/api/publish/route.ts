import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

type PlatformTarget = {
  platform: "youtube_shorts" | "instagram_reels" | "tiktok";
  account_id?: string;
  privacy?: "private" | "public" | "unlisted";
  publish_at?: string;
};

type PublishPayload = {
  job_id: string;
  final_video_url: string;
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

  const payload = (await req.json()) as PublishPayload;

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

  if (!payload.final_video_url) {
    return NextResponse.json(
      { error: "final_video_url is required" },
      { status: 400 }
    );
  }

  const results = [];

  for (const target of payload.platforms) {
    if (target.platform === "youtube_shorts") {
      results.push({
        platform: "youtube_shorts",
        status: "ready_for_youtube_upload",
        note: "YouTube upload adapter will be added next.",
      });
    }

    if (target.platform === "instagram_reels") {
      results.push({
        platform: "instagram_reels",
        status: "not_implemented_yet",
      });
    }

    if (target.platform === "tiktok") {
      results.push({
        platform: "tiktok",
        status: "needs_manual_action",
        video_url: payload.final_video_url,
        caption: payload.caption,
        hashtags: payload.hashtags ?? [],
      });
    }
  }

  return NextResponse.json({
    job_id: payload.job_id,
    status: "received",
    results,
  });
}