import { NextRequest, NextResponse } from "next/server";
import { uploadVideoFromUrlToDrive } from "@/lib/googleDriveOAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.PUBLISHER_API_KEY}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.source_video_url) {
    return NextResponse.json(
      { error: "source_video_url is required" },
      { status: 400 }
    );
  }

  if (!body.video_filename) {
    return NextResponse.json(
      { error: "video_filename is required" },
      { status: 400 }
    );
  }

  try {
    const result = await uploadVideoFromUrlToDrive({
      sourceVideoUrl: body.source_video_url,
      videoFilename: body.video_filename,
      folderId: body.folder_id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}