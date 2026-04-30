import { createReadStream } from "fs";
import { stat } from "fs/promises";
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
  await stat(filePath);

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
