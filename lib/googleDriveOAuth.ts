import { google } from "googleapis";
import { Readable } from "stream";

type UploadVideoInput = {
  sourceVideoUrl: string;
  videoFilename: string;
  folderId?: string;
};

export function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });

  return google.drive({
    version: "v3",
    auth: oauth2Client,
  });
}

export async function uploadVideoFromUrlToDrive(input: UploadVideoInput) {
  const { sourceVideoUrl, videoFilename, folderId } = input;

  if (!sourceVideoUrl) {
    throw new Error("sourceVideoUrl is required");
  }

  if (!videoFilename) {
    throw new Error("videoFilename is required");
  }

  const drive = getDriveClient();

  const videoResponse = await fetch(sourceVideoUrl);

  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Failed to fetch source video: ${sourceVideoUrl}`);
  }

  const videoStream = Readable.fromWeb(videoResponse.body as any);

  const targetFolderId = folderId || process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID;

  const fileMetadata: any = {
    name: videoFilename,
    mimeType: "video/mp4",
  };

  if (targetFolderId) {
    fileMetadata.parents = [targetFolderId];
  }

  const uploaded = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: "video/mp4",
      body: videoStream,
    },
    fields: "id,name,mimeType,size,webViewLink,webContentLink",
  });

  const fileId = uploaded.data.id;

  if (!fileId) {
    throw new Error("Google Drive upload failed: missing file ID");
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "anyone",
      role: "reader",
    },
  });

  const file = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,webViewLink,webContentLink",
  });

  return {
    success: true,
    file_id: file.data.id,
    name: file.data.name,
    mime_type: file.data.mimeType,
    size: file.data.size,
    web_view_link: file.data.webViewLink,
    web_content_link: file.data.webContentLink,
    final_video_url: `https://drive.google.com/uc?export=download&id=${fileId}`,
  };
}