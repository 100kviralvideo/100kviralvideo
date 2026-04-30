import { NextRequest, NextResponse } from "next/server";
import { findDriveVideo } from "@/lib/drive-video";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization")?.trim();
  const publisherApiKey = process.env.PUBLISHER_API_KEY?.trim();

  return Boolean(
    publisherApiKey && authHeader === `Bearer ${publisherApiKey}`
  );
}

async function parseBody(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return {
      body: null,
      error: "Invalid JSON body",
    };
  }

  if (!isRecord(body)) {
    return {
      body: null,
      error: "Request body must be a JSON object",
    };
  }

  if (typeof body.folder_id !== "string" || !body.folder_id.trim()) {
    return {
      body: null,
      error: "folder_id is required",
    };
  }

  if (
    typeof body.video_filename !== "string" ||
    !body.video_filename.trim()
  ) {
    return {
      body: null,
      error: "video_filename is required",
    };
  }

  return {
    body: {
      folder_id: body.folder_id.trim(),
      video_filename: body.video_filename.trim(),
    },
    error: null,
  };
}

export async function POST(req: NextRequest) {
  if (!validateAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { body, error } = await parseBody(req);

  if (!body) {
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    const file = await findDriveVideo({
      folderId: body.folder_id,
      videoFilename: body.video_filename,
    });

    if (!file) {
      return NextResponse.json(
        {
          error: `No video file named "${body.video_filename}" was found in the requested folder.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Drive error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
