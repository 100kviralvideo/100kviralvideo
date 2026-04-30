import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { createComfyJob } from "@/lib/comfy/jobs";
import {
  createImagePaths,
  downloadImage,
  queueComfyVideoJob,
  type ComfyGenerationOptions,
} from "@/lib/comfy/processor";

export const runtime = "nodejs";
export const maxDuration = 60;

type UrlGenerationRequest = ComfyGenerationOptions & {
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
    const jobId = crypto.randomUUID();
    const paths = await createImagePaths(jobId);

    await createComfyJob(jobId);
    await Promise.all(
      imageUrls.map((imageUrl, index) => downloadImage(imageUrl, paths[index]))
    );

    const job = await queueComfyVideoJob({
      jobId,
      globalPrompt,
      segmentPrompts,
      imagePaths: paths,
      options,
    });

    return NextResponse.json({
      job_id: jobId,
      prompt_id: job.prompt_id,
      status: job.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400 }
    );
  }
}
