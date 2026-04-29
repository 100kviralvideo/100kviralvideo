type EnvValue = string | undefined;

const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_CREATOR_INFO_URL =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const TIKTOK_VIDEO_INIT_URL =
  "https://open.tiktokapis.com/v2/post/publish/video/init/";
const TIKTOK_STATUS_FETCH_URL =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const FIVE_MB = 5 * 1024 * 1024;
const SIXTY_FOUR_MB = 64 * 1024 * 1024;

export type TikTokPlatformTarget = {
  privacy_level?: string;
  disable_duet?: boolean;
  disable_comment?: boolean;
  disable_stitch?: boolean;
};

export type TikTokPublishPayload = {
  final_video_url: string;
  caption: string;
  hashtags?: string[];
  duration_sec?: number;
  ai_generated?: boolean;
};

type TikTokError = {
  code?: string;
  message?: string;
  log_id?: string;
};

type TikTokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TikTokCreatorInfo = {
  privacy_level_options?: string[];
  max_video_post_duration_sec?: number;
  [key: string]: unknown;
};

type TikTokApiResponse<TData> = {
  data?: TData;
  error?: TikTokError;
};

function requireEnv(name: string, value: EnvValue) {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function assertTikTokOk<TData>(
  response: TikTokApiResponse<TData>,
  action: string
) {
  if (response.error?.code !== "ok") {
    throw new Error(
      `${action} failed: ${response.error?.message ?? response.error?.code ?? "Unknown TikTok error"}`
    );
  }

  if (!response.data) {
    throw new Error(`${action} failed: TikTok response did not include data`);
  }

  return response.data;
}

async function postForm<TResponse>(
  url: string,
  params: Record<string, string>
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = (await response.json()) as TResponse;

  if (!response.ok) {
    throw new Error(`TikTok token request failed with status ${response.status}`);
  }

  return data;
}

export function getTikTokAuthUrl() {
  const clientKey = requireEnv("TIKTOK_CLIENT_KEY", process.env.TIKTOK_CLIENT_KEY);
  const redirectUri = requireEnv(
    "TIKTOK_REDIRECT_URI",
    process.env.TIKTOK_REDIRECT_URI
  );
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");

  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic,video.publish");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", "publisher_tiktok_oauth");

  return url.toString();
}

export async function exchangeTikTokCode(code: string) {
  const clientKey = requireEnv("TIKTOK_CLIENT_KEY", process.env.TIKTOK_CLIENT_KEY);
  const clientSecret = requireEnv(
    "TIKTOK_CLIENT_SECRET",
    process.env.TIKTOK_CLIENT_SECRET
  );
  const redirectUri = requireEnv(
    "TIKTOK_REDIRECT_URI",
    process.env.TIKTOK_REDIRECT_URI
  );

  const data = await postForm<TikTokTokenResponse>(TIKTOK_TOKEN_URL, {
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  if (data.error) {
    throw new Error(data.error_description ?? data.error);
  }

  return data;
}

export async function refreshTikTokAccessToken() {
  const clientKey = requireEnv("TIKTOK_CLIENT_KEY", process.env.TIKTOK_CLIENT_KEY);
  const clientSecret = requireEnv(
    "TIKTOK_CLIENT_SECRET",
    process.env.TIKTOK_CLIENT_SECRET
  );
  const refreshToken = requireEnv(
    "TIKTOK_REFRESH_TOKEN",
    process.env.TIKTOK_REFRESH_TOKEN
  );

  const data = await postForm<TikTokTokenResponse>(TIKTOK_TOKEN_URL, {
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (data.error) {
    throw new Error(data.error_description ?? data.error);
  }

  if (!data.access_token) {
    throw new Error("TikTok refresh response did not include access_token");
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    open_id: data.open_id,
    scope: data.scope,
  };
}

export async function queryTikTokCreatorInfo(accessToken: string) {
  const response = await fetch(TIKTOK_CREATOR_INFO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({}),
  });
  const data = (await response.json()) as TikTokApiResponse<TikTokCreatorInfo>;

  if (!response.ok) {
    throw new Error(`TikTok creator info failed with status ${response.status}`);
  }

  return assertTikTokOk(data, "TikTok creator info query");
}

function buildTikTokTitle(payload: TikTokPublishPayload) {
  const hashtags =
    payload.hashtags
      ?.map((hashtag) => hashtag.trim())
      .filter(Boolean)
      .map((hashtag) => (hashtag.startsWith("#") ? hashtag : `#${hashtag}`))
      .join(" ") ?? "";

  return [payload.caption, hashtags].filter(Boolean).join(" ").slice(0, 2200);
}

async function downloadVideoBuffer(finalVideoUrl: string) {
  const response = await fetch(finalVideoUrl);

  if (!response.ok) {
    throw new Error(
      `Unable to download TikTok video: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function getChunkPlan(videoSize: number) {
  const chunkSize =
    videoSize < FIVE_MB ? videoSize : Math.min(videoSize, SIXTY_FOUR_MB);

  if (chunkSize <= 0) {
    throw new Error("TikTok video file is empty");
  }

  return {
    chunkSize,
    totalChunkCount: Math.ceil(videoSize / chunkSize),
  };
}

async function initializeTikTokDirectPost({
  accessToken,
  payload,
  target,
  privacyLevel,
  videoSize,
  chunkSize,
  totalChunkCount,
}: {
  accessToken: string;
  payload: TikTokPublishPayload;
  target: TikTokPlatformTarget;
  privacyLevel: string;
  videoSize: number;
  chunkSize: number;
  totalChunkCount: number;
}) {
  const response = await fetch(TIKTOK_VIDEO_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: buildTikTokTitle(payload),
        privacy_level: privacyLevel,
        disable_duet: target.disable_duet ?? false,
        disable_comment: target.disable_comment ?? false,
        disable_stitch: target.disable_stitch ?? false,
        video_cover_timestamp_ms: 1000,
        brand_content_toggle: false,
        brand_organic_toggle: false,
        is_aigc: payload.ai_generated ?? true,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  });
  const data = (await response.json()) as TikTokApiResponse<{
    publish_id?: string;
    upload_url?: string;
  }>;

  if (!response.ok) {
    throw new Error(`TikTok video init failed with status ${response.status}`);
  }

  const initData = assertTikTokOk(data, "TikTok video init");

  if (!initData.publish_id || !initData.upload_url) {
    throw new Error("TikTok video init did not include publish_id and upload_url");
  }

  return {
    publishId: initData.publish_id,
    uploadUrl: initData.upload_url,
  };
}

async function uploadTikTokChunks({
  uploadUrl,
  video,
  chunkSize,
}: {
  uploadUrl: string;
  video: Buffer;
  chunkSize: number;
}) {
  for (let start = 0; start < video.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, video.length) - 1;
    const chunk = video.subarray(start, end + 1);
    const body = chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength
    ) as ArrayBuffer;
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${video.length}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `TikTok chunk upload failed: ${response.status} ${response.statusText}`
      );
    }
  }
}

export async function publishTikTokDirectPost(
  payload: TikTokPublishPayload,
  target: TikTokPlatformTarget
) {
  const token = await refreshTikTokAccessToken();
  const creatorInfo = await queryTikTokCreatorInfo(token.access_token);
  const privacyLevel = target.privacy_level || "SELF_ONLY";
  const privacyOptions = creatorInfo.privacy_level_options ?? [];

  if (!privacyOptions.includes(privacyLevel)) {
    throw new Error(
      `TikTok privacy_level ${privacyLevel} is not available for this creator`
    );
  }

  if (
    creatorInfo.max_video_post_duration_sec &&
    payload.duration_sec &&
    payload.duration_sec > creatorInfo.max_video_post_duration_sec
  ) {
    throw new Error(
      `TikTok video duration exceeds max ${creatorInfo.max_video_post_duration_sec}s`
    );
  }

  const video = await downloadVideoBuffer(payload.final_video_url);
  const { chunkSize, totalChunkCount } = getChunkPlan(video.length);
  const { publishId, uploadUrl } = await initializeTikTokDirectPost({
    accessToken: token.access_token,
    payload,
    target,
    privacyLevel,
    videoSize: video.length,
    chunkSize,
    totalChunkCount,
  });

  // TODO: Move large TikTok uploads to a queue/worker on Railway, Render, Fly.io, or Cloud Run if Vercel timeouts become an issue.
  await uploadTikTokChunks({
    uploadUrl,
    video,
    chunkSize,
  });

  return {
    platform: "tiktok",
    status: "published_or_processing",
    publish_id: publishId,
    privacy_level: privacyLevel,
  };
}

export async function fetchTikTokPostStatus(
  accessToken: string,
  publishId: string
) {
  const response = await fetch(TIKTOK_STATUS_FETCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      publish_id: publishId,
    }),
  });
  const data = (await response.json()) as TikTokApiResponse<Record<string, unknown>>;

  if (!response.ok) {
    throw new Error(`TikTok status fetch failed with status ${response.status}`);
  }

  return assertTikTokOk(data, "TikTok status fetch");
}
