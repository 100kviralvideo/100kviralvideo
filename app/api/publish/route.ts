import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { uploadYouTubeShort, YouTubePrivacyStatus } from "@/lib/youtube";
import { addPublishHistoryItem } from "@/lib/publish-history";
import { publishInstagramReel } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

type PlatformTarget = {
  platform: "youtube_shorts" | "instagram_reels" | "tiktok";
  account_id?: string;
  privacy?: YouTubePrivacyStatus;
  privacy_level?: string;
  disable_duet?: boolean;
  disable_comment?: boolean;
  disable_stitch?: boolean;
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

type PlatformResult = {
  platform: PlatformTarget["platform"] | string;
  status: string;
  error?: string;
  [key: string]: unknown;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateString(
  payload: Record<string, unknown>,
  field: keyof PublishPayload,
  errors: string[]
) {
  if (typeof payload[field] !== "string" || !payload[field].trim()) {
    errors.push(`${field} is required`);
  }
}

function validateBoolean(
  payload: Record<string, unknown>,
  field: keyof PublishPayload,
  errors: string[]
) {
  if (typeof payload[field] !== "boolean") {
    errors.push(`${field} must be a boolean`);
  }
}

function validatePublishPayload(value: unknown) {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { payload: null, errors: ["Request body must be a JSON object"] };
  }

  validateString(value, "job_id", errors);
  validateString(value, "final_video_url", errors);
  validateString(value, "title", errors);
  validateString(value, "caption", errors);
  validateString(value, "description", errors);
  validateBoolean(value, "human_approved", errors);
  validateBoolean(value, "rights_cleared", errors);
  validateBoolean(value, "ai_generated", errors);

  if (typeof value.duration_sec !== "number") {
    errors.push("duration_sec must be a number");
  }

  if (
    !Array.isArray(value.hashtags) ||
    value.hashtags.some((hashtag) => typeof hashtag !== "string")
  ) {
    errors.push("hashtags must be an array of strings");
  }

  if (!Array.isArray(value.platforms) || value.platforms.length === 0) {
    errors.push("platforms must be a non-empty array");
  } else {
    value.platforms.forEach((target, index) => {
      if (!isRecord(target)) {
        errors.push(`platforms[${index}] must be an object`);
        return;
      }

      if (
        target.platform !== "youtube_shorts" &&
        target.platform !== "instagram_reels" &&
        target.platform !== "tiktok"
      ) {
        errors.push(`platforms[${index}].platform is invalid`);
      }

      if (
        target.privacy !== undefined &&
        target.privacy !== "private" &&
        target.privacy !== "public" &&
        target.privacy !== "unlisted"
      ) {
        errors.push(`platforms[${index}].privacy is invalid`);
      }

      if (
        target.publish_at !== undefined &&
        typeof target.publish_at !== "string"
      ) {
        errors.push(`platforms[${index}].publish_at must be a string`);
      }

      if (
        target.privacy_level !== undefined &&
        typeof target.privacy_level !== "string"
      ) {
        errors.push(`platforms[${index}].privacy_level must be a string`);
      }

      for (const field of [
        "disable_duet",
        "disable_comment",
        "disable_stitch",
      ]) {
        if (target[field] !== undefined && typeof target[field] !== "boolean") {
          errors.push(`platforms[${index}].${field} must be a boolean`);
        }
      }
    });
  }

  return {
    payload: errors.length ? null : (value as PublishPayload),
    errors,
  };
}

export async function POST(req: NextRequest) {
  if (!validatePublisherAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, errors } = validatePublishPayload(body);

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body", errors }, { status: 400 });
  }

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

  const results: PlatformResult[] = [];

  for (const target of payload.platforms) {
    if (target.platform === "youtube_shorts") {
      try {
        const upload = await uploadYouTubeShort({
          finalVideoUrl: payload.final_video_url,
          title: payload.title,
          caption: payload.caption,
          description: payload.description,
          hashtags: payload.hashtags,
          aiGenerated: payload.ai_generated,
          privacy: target.privacy,
          publishAt: target.publish_at,
        });

        results.push({
          platform: "youtube_shorts",
          status: "uploaded",
          ...upload,
        });
      } catch (error) {
        results.push({
          platform: "youtube_shorts",
          status: "failed",
          error: errorMessage(error),
        });
      }
    }

    if (target.platform === "instagram_reels") {
      try {
        const publish = await publishInstagramReel(payload, target);

        results.push(publish);
      } catch (error) {
        results.push({
          platform: "instagram_reels",
          status: "failed",
          error: errorMessage(error),
          video_url: payload.final_video_url,
          caption: payload.caption,
          hashtags: payload.hashtags ?? [],
        });
      }
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

  const historyItem = {
    job_id: payload.job_id,
    title: payload.title,
    final_video_url: payload.final_video_url,
    duration_sec: payload.duration_sec,
    ai_generated: payload.ai_generated,
    status: "processed",
    created_at: new Date().toISOString(),
    results,
  };

  try {
    await addPublishHistoryItem(historyItem);
  } catch (error) {
    console.error("Unable to store publish history", error);
    results.push({
      platform: "history",
      status: "failed",
      error: errorMessage(error),
    });
  }

  return NextResponse.json({
    job_id: payload.job_id,
    status: "processed",
    results,
  });
}
