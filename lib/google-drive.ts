import { createReadStream } from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { google } from "googleapis";

export function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createGoogleDriveOAuthClient() {
  const clientId = getRequiredEnv("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_DRIVE_CLIENT_SECRET");
  const redirectUri = getRequiredEnv("GOOGLE_DRIVE_REDIRECT_URI");

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function isGoogleDriveOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim() &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim()
  );
}

export function isGoogleDriveServiceAccountConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim() &&
      process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim()
  );
}

export function isGoogleDriveConfigured() {
  return (
    isGoogleDriveServiceAccountConfigured() || isGoogleDriveOAuthConfigured()
  );
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function createGoogleDriveServiceAccountAuth() {
  const clientEmail = getRequiredEnv("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(
    getRequiredEnv("GOOGLE_DRIVE_PRIVATE_KEY")
  );

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

function assertGoogleDriveConfigured() {
  if (isGoogleDriveConfigured()) {
    return;
  }

  const missing = [
    "GOOGLE_DRIVE_CLIENT_EMAIL",
    "GOOGLE_DRIVE_PRIVATE_KEY",
  ].filter((name) => !process.env[name]?.trim());

  throw new Error(
    `Google Drive is not configured. Missing service account env: ${missing.join(
      ", "
    )}. Or configure OAuth with GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI, and GOOGLE_DRIVE_REFRESH_TOKEN.`
  );
}

export function getGoogleDriveAuthUrl() {
  const oauth2Client = createGoogleDriveOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive"],
  });
}

export async function getGoogleDriveTokens(code: string) {
  const oauth2Client = createGoogleDriveOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  return tokens;
}

export function createGoogleDriveClient() {
  assertGoogleDriveConfigured();

  if (isGoogleDriveServiceAccountConfigured()) {
    const auth = createGoogleDriveServiceAccountAuth();

    return google.drive({ version: "v3", auth });
  }

  const refreshToken = getRequiredEnv("GOOGLE_DRIVE_REFRESH_TOKEN");
  const auth = createGoogleDriveOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth });
}

export function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function makeDriveFilePublic(fileId: string) {
  const drive = createGoogleDriveClient();

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: "anyone",
        role: "reader",
      },
      supportsAllDrives: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.toLowerCase().includes("permission already exists")) {
      throw error;
    }
  }
}

export type DriveVideoLookupResult = {
  success: true;
  file_id: string;
  name?: string | null;
  mime_type?: string | null;
  size?: string | null;
  created_time?: string | null;
  web_view_link?: string | null;
  web_content_link?: string | null;
  final_video_url: string;
  warning: string | null;
};

export async function findDriveVideo({
  folderId,
  videoFilename,
}: {
  folderId: string;
  videoFilename: string;
}): Promise<DriveVideoLookupResult | null> {
  const drive = createGoogleDriveClient();
  const query = [
    `name = '${escapeDriveQueryValue(videoFilename)}'`,
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    "trashed = false",
  ].join(" and ");

  const filesResponse = await drive.files.list({
    q: query,
    orderBy: "createdTime desc",
    pageSize: 10,
    fields:
      "files(id,name,mimeType,size,createdTime,webViewLink,webContentLink)",
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

  await makeDriveFilePublic(selectedFile.id);

  const refreshedFileResponse = await drive.files.get({
    fileId: selectedFile.id,
    fields: "id,name,mimeType,size,createdTime,webViewLink,webContentLink",
    supportsAllDrives: true,
  });
  const file = refreshedFileResponse.data;

  if (!file.id) {
    throw new Error("Google Drive returned a file without an id");
  }

  return {
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
      files.length > 1 ? "Multiple files found; newest file selected." : null,
  };
}

export async function uploadVideoToDrive({
  filePath,
  folderId,
  fileName,
  makePublic = true,
}: {
  filePath: string;
  folderId: string;
  fileName?: string;
  makePublic?: boolean;
}) {
  await fsPromises.stat(filePath);

  const drive = createGoogleDriveClient();
  const uploadName = fileName || path.basename(filePath);
  const response = await drive.files.create({
    requestBody: {
      name: uploadName,
      parents: [folderId],
    },
    media: {
      mimeType: "video/mp4",
      body: createReadStream(filePath),
    },
    fields: "id,name,mimeType,size,createdTime,webViewLink,webContentLink",
    supportsAllDrives: true,
  });
  const file = response.data;

  if (!file.id) {
    throw new Error("Google Drive returned a file without an id");
  }

  if (makePublic) {
    await makeDriveFilePublic(file.id);
  }

  const refreshed = await drive.files.get({
    fileId: file.id,
    fields: "id,name,mimeType,size,createdTime,webViewLink,webContentLink",
    supportsAllDrives: true,
  });

  return {
    file: refreshed.data,
    drive_link: `https://drive.google.com/file/d/${file.id}/view`,
    final_video_url: `https://drive.google.com/uc?export=download&id=${file.id}`,
  };
}
