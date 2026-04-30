import { google } from "googleapis";

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

  return {
    success: true,
    file_id: file.id ?? selectedFile.id,
    name: file.name ?? selectedFile.name ?? videoFilename,
    mime_type: file.mimeType,
    size: file.size,
    created_time: file.createdTime,
    web_view_link: file.webViewLink,
    web_content_link: file.webContentLink,
    final_video_url: `https://drive.google.com/uc?export=download&id=${
      file.id ?? selectedFile.id
    }`,
    warning:
      files.length > 1 ? "Multiple files found; newest file selected." : null,
  };
}
