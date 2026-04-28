import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { google } from "googleapis";

export type YouTubePrivacyStatus = "private" | "public" | "unlisted";

export type UploadYouTubeShortInput = {
  finalVideoUrl: string;
  title: string;
  caption: string;
  description?: string;
  hashtags?: string[];
  aiGenerated?: boolean;
  privacy?: YouTubePrivacyStatus;
  publishAt?: string;
};

type EnvValue = string | undefined;

function requireEnv(name: string, value: EnvValue) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createYouTubeOAuthClient() {
  const clientId = requireEnv("YOUTUBE_CLIENT_ID", process.env.YOUTUBE_CLIENT_ID);
  const clientSecret = requireEnv(
    "YOUTUBE_CLIENT_SECRET",
    process.env.YOUTUBE_CLIENT_SECRET
  );
  const redirectUri = requireEnv(
    "YOUTUBE_REDIRECT_URI",
    process.env.YOUTUBE_REDIRECT_URI
  );

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getYouTubeAuthUrl() {
  const oauth2Client = createYouTubeOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });
}

export async function getYouTubeTokens(code: string) {
  const oauth2Client = createYouTubeOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  return tokens;
}

function titleWithShorts(title: string) {
  return /(^|\s)#shorts(\s|$)/i.test(title) ? title : `${title} #Shorts`;
}

function buildDescription(input: UploadYouTubeShortInput) {
  const descriptionParts = [input.description, input.caption].filter(Boolean);
  const hashtags = input.hashtags
    ?.map((hashtag) => hashtag.trim())
    .filter(Boolean)
    .map((hashtag) => (hashtag.startsWith("#") ? hashtag : `#${hashtag}`));

  if (hashtags?.length) {
    descriptionParts.push(hashtags.join(" "));
  }

  return descriptionParts.join("\n\n");
}

async function getVideoStream(finalVideoUrl: string) {
  const response = await fetch(finalVideoUrl);

  if (!response.ok || !response.body) {
    throw new Error(
      `Unable to download video: ${response.status} ${response.statusText}`
    );
  }

  return {
    stream: Readable.fromWeb(response.body as NodeReadableStream),
    contentType: response.headers.get("content-type") ?? "video/mp4",
  };
}

export async function uploadYouTubeShort(input: UploadYouTubeShortInput) {
  const refreshToken = requireEnv(
    "YOUTUBE_REFRESH_TOKEN",
    process.env.YOUTUBE_REFRESH_TOKEN
  );
  const oauth2Client = createYouTubeOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });
  const { stream, contentType } = await getVideoStream(input.finalVideoUrl);
  const scheduledPublish = Boolean(input.publishAt);

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    notifySubscribers: false,
    requestBody: {
      snippet: {
        title: titleWithShorts(input.title),
        description: buildDescription(input),
        categoryId: "24",
      },
      status: {
        privacyStatus: scheduledPublish ? "private" : input.privacy ?? "private",
        publishAt: input.publishAt,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: Boolean(input.aiGenerated),
      },
    },
    media: {
      mimeType: contentType,
      body: stream,
    },
  });

  return {
    video_id: response.data.id,
    title: response.data.snippet?.title,
    privacyStatus: response.data.status?.privacyStatus,
    publishAt: response.data.status?.publishAt,
    youtube_url: response.data.id
      ? `https://www.youtube.com/watch?v=${response.data.id}`
      : undefined,
  };
}
