import { after, NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { createComfyJob } from "@/lib/comfy/jobs";
import {
  createImagePaths,
  downloadImage,
  queueComfyVideoJob,
  waitForQueuedComfyVideoJob,
  type ComfyGenerationOptions,
} from "@/lib/comfy/processor";

export const runtime = "nodejs";
export const maxDuration = 60;

type UrlGenerationRequest = ComfyGenerationOptions & {
  title?: unknown;
  video_title?: unknown;
  caption?: unknown;
  description?: unknown;
  hashtags?: unknown;
  prompt?: unknown;
  global_prompt?: unknown;
  prompt_1?: unknown;
  prompt_2?: unknown;
  prompt_3?: unknown;
  prompt_4?: unknown;
  prompt_5?: unknown;
  segment_prompts?: unknown;
  segment_1_prompt?: unknown;
  segment_2_prompt?: unknown;
  segment_3_prompt?: unknown;
  segment_4_prompt?: unknown;
  segment_1_image_url?: unknown;
  segment_2_image_url?: unknown;
  segment_3_image_url?: unknown;
  segment_4_image_url?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredUrl(body: UrlGenerationRequest, field: keyof UrlGenerationRequest) {
  const value = body[field];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return new URL(value.trim()).toString();
}

function optionalNumber(body: UrlGenerationRequest, field: keyof ComfyGenerationOptions) {
  const value = (body as Record<string, unknown>)[field];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }

  return value;
}

function optionalNumberArray(body: UrlGenerationRequest, field: keyof ComfyGenerationOptions) {
  const value = (body as Record<string, unknown>)[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    throw new Error(`${field} must be an array of numbers`);
  }

  return value;
}

function optionalStringArray(body: UrlGenerationRequest, field: keyof UrlGenerationRequest) {
  const value = body[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${field} must be an array of strings`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function getString(body: UrlGenerationRequest, fields: (keyof UrlGenerationRequest)[]) {
  for (const field of fields) {
    const value = body[field];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getSegmentPrompts(body: UrlGenerationRequest) {
  if (Array.isArray(body.segment_prompts)) {
    if (
      body.segment_prompts.some(
        (value) => typeof value !== "string" || !value.trim()
      )
    ) {
      throw new Error("segment_prompts must be an array of strings");
    }

    return body.segment_prompts.map((value) => value.trim());
  }

  return [1, 2, 3, 4]
    .map((index) =>
      getString(body, [
        `segment_${index}_prompt` as keyof UrlGenerationRequest,
        `prompt_${index + 1}` as keyof UrlGenerationRequest,
      ])
    )
    .filter((value): value is string => Boolean(value));
}

function calculateDurationSec(segmentLengths: number[] | undefined, fps: number | undefined) {
  if (!segmentLengths?.length || !fps || fps <= 0) {
    return undefined;
  }

  const frameCount = segmentLengths.reduce((sum, value) => sum + value, 0);
  return Math.round((frameCount / fps) * 1000) / 1000;
}

function buildStatusUrl({
  jobId,
  promptId,
  clientId,
  title,
}: {
  jobId: string;
  promptId: string | undefined;
  clientId: string | undefined;
  title: string | undefined;
}) {
  const params = new URLSearchParams();

  if (promptId) {
    params.set("prompt_id", promptId);
  }

  if (clientId) {
    params.set("client_id", clientId);
  }

  if (title) {
    params.set("title", title);
  }

  const query = params.toString();
  return `/api/comfy/jobs/${encodeURIComponent(jobId)}${query ? `?${query}` : ""}`;
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

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  try {
    const request = body as UrlGenerationRequest;
    const globalPrompt = getString(request, ["global_prompt", "prompt", "prompt_1"]);

    if (!globalPrompt) {
      return NextResponse.json(
        { error: "global_prompt or prompt_1 is required" },
        { status: 400 }
      );
    }

    const segmentPrompts = getSegmentPrompts(request);

    if (segmentPrompts.length !== 4) {
      return NextResponse.json(
        { error: "Exactly 4 segment prompts are required" },
        { status: 400 }
      );
    }

    const imageUrls = [
      requiredUrl(request, "segment_1_image_url"),
      requiredUrl(request, "segment_2_image_url"),
      requiredUrl(request, "segment_3_image_url"),
      requiredUrl(request, "segment_4_image_url"),
    ];
    const options: ComfyGenerationOptions = {
      width: optionalNumber(request, "width"),
      height: optionalNumber(request, "height"),
      fps: optionalNumber(request, "fps"),
      segment_lengths: optionalNumberArray(request, "segment_lengths"),
      image_strength: optionalNumber(request, "image_strength"),
    };
    const title = getString(request, ["title", "video_title"]) || undefined;
    const caption = getString(request, ["caption"]) || undefined;
    const description = getString(request, ["description"]) || undefined;
    const hashtags = optionalStringArray(request, "hashtags");

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!caption) {
      return NextResponse.json({ error: "caption is required" }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    if (!hashtags?.length) {
      return NextResponse.json(
        { error: "hashtags must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    const durationSec = calculateDurationSec(options.segment_lengths, options.fps);
    const jobId = crypto.randomUUID();
    const paths = await createImagePaths(jobId);

    await createComfyJob(jobId, {
      title,
      caption,
      description,
      hashtags,
      duration_sec: durationSec,
      segment_lengths: options.segment_lengths,
      fps: options.fps,
    });
    await Promise.all(
      imageUrls.map((imageUrl, index) => downloadImage(imageUrl, paths[index]))
    );

    const job = await queueComfyVideoJob({
      jobId,
      title,
      globalPrompt,
      segmentPrompts,
      imagePaths: paths,
      options,
    });

    if (job.prompt_id) {
      if (!process.env.VERCEL) {
        after(async () => {
          await waitForQueuedComfyVideoJob({
            jobId,
            promptId: job.prompt_id!,
            clientId: job.comfy_client_id,
          });
        });
      }
    }

    return NextResponse.json({
      job_id: jobId,
      title: title || null,
      caption: caption || null,
      description: description || null,
      hashtags: hashtags || [],
      duration_sec: durationSec || null,
      status_url: buildStatusUrl({
        jobId,
        promptId: job.prompt_id,
        clientId: job.comfy_client_id,
        title,
      }),
      prompt_id: job.prompt_id,
      comfy_client_id: job.comfy_client_id,
      status: job.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400 }
    );
  }
}
