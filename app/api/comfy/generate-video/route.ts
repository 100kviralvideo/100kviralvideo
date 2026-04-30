import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import { createComfyJob } from "@/lib/comfy/jobs";
import {
  createImagePaths,
  processComfyVideoJob,
  saveUploadedImage,
  type ComfyGenerationOptions,
} from "@/lib/comfy/processor";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseOptionalNumber(form: FormData, name: string) {
  const value = form.get(name);

  if (value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${name} must be a number`);
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${name} must be a number`);
  }

  return numberValue;
}

function parseSegmentLengths(form: FormData) {
  const csv = form.get("segment_lengths");

  if (typeof csv === "string" && csv.trim()) {
    return csv.split(",").map((item) => {
      const value = Number(item.trim());

      if (!Number.isFinite(value)) {
        throw new Error("segment_lengths must be a comma-separated number list");
      }

      return value;
    });
  }

  const values = [1, 2, 3, 4]
    .map((index) => parseOptionalNumber(form, `segment_${index}_length`))
    .filter((value): value is number => value !== undefined);

  return values.length ? values : undefined;
}

function getRequiredFile(form: FormData, name: string) {
  const value = form.get(name);

  if (!(value instanceof File) || value.size === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getPrompt(form: FormData, names: string[]) {
  for (const name of names) {
    const value = form.get(name);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getSegmentPrompts(form: FormData) {
  const rawSegmentPrompts = form.get("segment_prompts");

  if (typeof rawSegmentPrompts === "string" && rawSegmentPrompts.trim()) {
    const parsed = JSON.parse(rawSegmentPrompts) as unknown;

    if (
      !Array.isArray(parsed) ||
      parsed.some((value) => typeof value !== "string" || !value.trim())
    ) {
      throw new Error("segment_prompts must be a JSON array of strings");
    }

    return parsed.map((value) => value.trim());
  }

  return [1, 2, 3, 4]
    .map((index) =>
      getPrompt(form, [`segment_${index}_prompt`, `prompt_${index + 1}`])
    )
    .filter((value): value is string => Boolean(value));
}

function getImageFiles(form: FormData) {
  return [
    getRequiredFile(form, "segment_1_image"),
    getRequiredFile(form, "segment_2_image"),
    getRequiredFile(form, "segment_3_image"),
    getRequiredFile(form, "segment_4_image"),
  ];
}

export async function POST(req: NextRequest) {
  if (!validatePublisherAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;

  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form body" }, { status: 400 });
  }

  try {
    const globalPrompt = getPrompt(form, ["global_prompt", "prompt", "prompt_1"]);

    if (!globalPrompt) {
      return NextResponse.json(
        { error: "global_prompt or prompt_1 is required" },
        { status: 400 }
      );
    }

    const imageFiles = getImageFiles(form);
    const segmentPrompts = getSegmentPrompts(form);

    if (segmentPrompts.length !== 4) {
      return NextResponse.json(
        { error: "Exactly 4 segment prompts are required" },
        { status: 400 }
      );
    }

    const options: ComfyGenerationOptions = {
      width: parseOptionalNumber(form, "width"),
      height: parseOptionalNumber(form, "height"),
      fps: parseOptionalNumber(form, "fps"),
      segment_lengths: parseSegmentLengths(form),
      image_strength: parseOptionalNumber(form, "image_strength"),
    };
    const jobId = crypto.randomUUID();
    const paths = await createImagePaths(jobId);

    createComfyJob(jobId);
    await Promise.all(
      imageFiles.map((imageFile, index) =>
        saveUploadedImage(imageFile, paths[index])
      )
    );

    void processComfyVideoJob({
      jobId,
      globalPrompt,
      segmentPrompts,
      imagePaths: paths,
      options,
    });

    return NextResponse.json({ job_id: jobId, status: "queued" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400 }
    );
  }
}
