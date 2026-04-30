import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { findDriveVideo } from "@/lib/google-drive";
import { savePrePublishItem } from "@/lib/prepublish-queue";
import { isRecord, PlatformTarget, PublishPayload } from "@/lib/publisher";

export const runtime = "nodejs";
export const maxDuration = 60;

type PrePublishRequest = {
  job_id: string;
  folder_id: string;
  video_filename: string;
  title: string;
  caption: string;
  description?: string;
  hashtags?: string[];
  duration_sec?: number;
  ai_generated?: boolean;
  platforms: PlatformTarget[];
};

function validatePlatformTargets(value: unknown, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("platforms must be a non-empty array");
    return;
  }

  value.forEach((target, index) => {
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
  });
}

function validatePrePublishBody(value: unknown) {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { body: null, errors: ["Request body must be a JSON object"] };
  }

  for (const field of [
    "job_id",
    "folder_id",
    "video_filename",
    "title",
    "caption",
  ]) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      errors.push(`${field} is required`);
    }
  }

  if (
    value.description !== undefined &&
    typeof value.description !== "string"
  ) {
    errors.push("description must be a string");
  }

  if (
    value.hashtags !== undefined &&
    (!Array.isArray(value.hashtags) ||
      value.hashtags.some((hashtag) => typeof hashtag !== "string"))
  ) {
    errors.push("hashtags must be an array of strings");
  }

  if (
    value.duration_sec !== undefined &&
    typeof value.duration_sec !== "number"
  ) {
    errors.push("duration_sec must be a number");
  }

  if (
    value.ai_generated !== undefined &&
    typeof value.ai_generated !== "boolean"
  ) {
    errors.push("ai_generated must be a boolean");
  }

  validatePlatformTargets(value.platforms, errors);

  const platforms = Array.isArray(value.platforms)
    ? (value.platforms as PlatformTarget[])
    : [];

  return {
    body: errors.length
      ? null
      : ({
          job_id: String(value.job_id).trim(),
          folder_id: String(value.folder_id).trim(),
          video_filename: String(value.video_filename).trim(),
          title: String(value.title).trim(),
          caption: String(value.caption).trim(),
          description:
            typeof value.description === "string"
              ? value.description.trim()
              : "",
          hashtags: Array.isArray(value.hashtags) ? value.hashtags : [],
          duration_sec:
            typeof value.duration_sec === "number" ? value.duration_sec : 0,
          ai_generated:
            typeof value.ai_generated === "boolean"
              ? value.ai_generated
              : true,
          platforms,
        } as PrePublishRequest),
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

  const { body: payload, errors } = validatePrePublishBody(body);

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid request body", errors },
      { status: 400 }
    );
  }

  try {
    const driveVideo = await findDriveVideo({
      folderId: payload.folder_id,
      videoFilename: payload.video_filename,
    });

    if (!driveVideo) {
      return NextResponse.json(
        {
          error: `No video file named "${payload.video_filename}" was found in the requested folder.`,
        },
        { status: 404 }
      );
    }

    const publishPayload: PublishPayload = {
      job_id: payload.job_id,
      final_video_url: driveVideo.final_video_url,
      title: payload.title,
      caption: payload.caption,
      description: payload.description,
      hashtags: payload.hashtags,
      duration_sec: payload.duration_sec,
      human_approved: false,
      rights_cleared: false,
      ai_generated: payload.ai_generated,
      platforms: payload.platforms,
    };
    const item = await savePrePublishItem({
      folder_id: payload.folder_id,
      video_filename: payload.video_filename,
      drive_file: driveVideo,
      payload: publishPayload,
    });

    return NextResponse.json({
      success: true,
      status: "pending",
      preview: {
        ...item,
        publish_payload: publishPayload,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
