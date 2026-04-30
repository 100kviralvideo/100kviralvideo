import { google } from "googleapis";
import { Readable } from "node:stream";

export type DriveVideoResult = {
  success: true;
  file_id: string;
  name: string;
  mime_type?: string | null;
  size?: string | null;
  created_time?: string | null;
  web_view_link?: string | null;
  web_content_link?: string | null;
  final_video_url: string;
  warning: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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

async function setAnyoneReaderPermission({
  drive,
  fileId,
}: {
  drive: ReturnType<typeof createDriveClient>;
  fileId: string;
}) {
  try {
    await drive.permissions.create({
      fileId,
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
}

async function getDriveVideoResult({
  drive,
  fileId,
  fallbackName,
  warning,
}: {
  drive: ReturnType<typeof createDriveClient>;
  fileId: string;
  fallbackName: string;
  warning: string | null;
}) {
  const refreshedFileResponse = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,createdTime,webViewLink,webContentLink",
    supportsAllDrives: true,
  });
  const file = refreshedFileResponse.data;

  return {
    success: true,
    file_id: file.id ?? fileId,
    name: file.name ?? fallbackName,
    mime_type: file.mimeType,
    size: file.size,
    created_time: file.createdTime,
    web_view_link: file.webViewLink,
    web_content_link: file.webContentLink,
    final_video_url: `https://drive.google.com/uc?export=download&id=${
      file.id ?? fileId
    }`,
    warning,
  } satisfies DriveVideoResult;
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildDriveQuery({
  folderId,
  videoFilename,
}: {
  folderId: string;
  videoFilename: string;
}) {
  const escapedFolderId = escapeDriveQueryValue(folderId);
  const escapedFilename = escapeDriveQueryValue(videoFilename);

  return [
    `name = '${escapedFilename}'`,
    `'${escapedFolderId}' in parents`,
    "trashed = false",
  ].join(" and ");
}

export async function findDriveVideo({
  folderId,
  videoFilename,
}: {
  folderId: string;
  videoFilename: string;
}): Promise<DriveVideoResult | null> {
  const drive = createDriveClient();
  const filesResponse = await drive.files.list({
    q: buildDriveQuery({ folderId, videoFilename }),
    orderBy: "createdTime desc",
    pageSize: 10,
    fields: "files(id,name,mimeType,size,createdTime,webViewLink,webContentLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = filesResponse.data.files ?? [];

  if (files.length === 0) {
    return null;
  }

  const selectedFile = files[0];

  if (!selectedFile.id) {
    throw new Error("Google Drive returned a file without an id");
  }

  await setAnyoneReaderPermission({ drive, fileId: selectedFile.id });

  return getDriveVideoResult({
    drive,
    fileId: selectedFile.id,
    fallbackName: selectedFile.name ?? videoFilename,
    warning:
      files.length > 1 ? "Multiple files found; newest file selected." : null,
  });
}

export async function uploadVideoToDrive({
  filename,
  mimeType,
  buffer,
}: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const folderId = getRequiredEnv("GOOGLE_DRIVE_FOLDER_ID");
  const drive = createDriveClient();
  const uploadResponse = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const fileId = uploadResponse.data.id;

  if (!fileId) {
    throw new Error("Google Drive upload did not return a file id");
  }

  await setAnyoneReaderPermission({ drive, fileId });

  return getDriveVideoResult({
    drive,
    fileId,
    fallbackName: filename,
    warning: null,
  });
}
