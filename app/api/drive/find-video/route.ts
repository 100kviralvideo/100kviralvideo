import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

type FindVideoBody = {
  folder_id: string;
  video_filename: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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

function createDriveClient() {
  const clientEmail = getRequiredEnv("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_DRIVE_PRIVATE_KEY").replace(
    /\\n/g,
    "\n"
  );
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildDriveQuery({ folder_id, video_filename }: FindVideoBody) {
  const folderId = escapeDriveQueryValue(folder_id);
  const filename = escapeDriveQueryValue(video_filename);

  return [
    `name = '${filename}'`,
    `'${folderId}' in parents`,
    "trashed = false",
  ].join(" and ");
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
    const drive = createDriveClient();
    const filesResponse = await drive.files.list({
      q: buildDriveQuery(body),
      orderBy: "createdTime desc",
      pageSize: 10,
      fields:
        "files(id,name,mimeType,size,createdTime,webViewLink,webContentLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = filesResponse.data.files ?? [];

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: `No video file named "${body.video_filename}" was found in the requested folder.`,
        },
        { status: 404 }
      );
    }

    const selectedFile = files[0];

    if (!selectedFile.id) {
      throw new Error("Google Drive returned a file without an id");
    }

    try {
      await drive.permissions.create({
        fileId: selectedFile.id,
        requestBody: {
          type: "anyone",
          role: "reader",
        },
        supportsAllDrives: true,
      });
    } catch (permissionError) {
      const message =
        permissionError instanceof Error ? permissionError.message : "";

      if (!message.toLowerCase().includes("permission already exists")) {
        throw permissionError;
      }
    }

    const refreshedFileResponse = await drive.files.get({
      fileId: selectedFile.id,
      fields: "id,name,mimeType,size,createdTime,webViewLink,webContentLink",
      supportsAllDrives: true,
    });
    const file = refreshedFileResponse.data;

    return NextResponse.json({
      success: true,
      file_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      size: file.size,
      created_time: file.createdTime,
      web_view_link: file.webViewLink,
      web_content_link: file.webContentLink,
      final_video_url: `https://drive.google.com/uc?export=download&id=${file.id}`,
      warning:
        files.length > 1
          ? "Multiple files found; newest file selected."
          : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Drive error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
