import { NextRequest, NextResponse } from "next/server";
import { uploadVideoToDrive } from "@/lib/drive-video";

export const runtime = "nodejs";
export const maxDuration = 60;

function validateAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization")?.trim();
  const publisherApiKey = process.env.PUBLISHER_API_KEY?.trim();

  return Boolean(
    publisherApiKey && authHeader === `Bearer ${publisherApiKey}`
  );
}

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

export async function POST(req: NextRequest) {
  if (!validateAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!isFile(file)) {
      return NextResponse.json(
        { error: "file is required and must be a video file" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "file must have a video/* content type" },
        { status: 400 }
      );
    }

    const filename =
      formData.get("filename")?.toString().trim() || file.name || "test.mp4";
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadedFile = await uploadVideoToDrive({
      filename,
      mimeType: file.type || "video/mp4",
      buffer,
    });

    return NextResponse.json(uploadedFile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Drive upload error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
