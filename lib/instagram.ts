type EnvValue = string | undefined;

const DEFAULT_GRAPH_VERSION = "v25.0";
const MAX_INSTAGRAM_CAPTION_LENGTH = 2200;
const POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 5000;
const GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export type InstagramPublishPayload = {
  final_video_url: string;
  caption: string;
  description?: string;
  hashtags?: string[];
  ai_generated?: boolean;
};

export type InstagramPlatformTarget = {
  platform: string;
};

type InstagramErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type MediaContainerResponse = InstagramErrorResponse & {
  id?: string;
};

type ContainerStatusResponse = InstagramErrorResponse & {
  status_code?: string;
  status?: string;
};

type MediaPublishResponse = InstagramErrorResponse & {
  id?: string;
};

function requireEnv(name: string, value: EnvValue) {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getInstagramConfig() {
  return {
    accessToken: requireEnv("META_ACCESS_TOKEN", process.env.META_ACCESS_TOKEN),
    igUserId: requireEnv("IG_USER_ID", process.env.IG_USER_ID),
    graphVersion:
      process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
  };
}

function assertNoGraphError<TResponse extends InstagramErrorResponse>(
  response: TResponse,
  action: string
) {
  if (response.error) {
    throw new Error(
      `${action} failed: ${response.error.message ?? "Unknown Instagram Graph API error"}`
    );
  }

  return response;
}

function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value);
    return GOOGLE_DRIVE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function formatHashtags(hashtags?: string[]) {
  return (
    hashtags
      ?.map((hashtag) => hashtag.trim())
      .filter(Boolean)
      .map((hashtag) => (hashtag.startsWith("#") ? hashtag : `#${hashtag}`))
      .join(" ") ?? ""
  );
}

function truncateCaption(value: string) {
  return Array.from(value).slice(0, MAX_INSTAGRAM_CAPTION_LENGTH).join("");
}

function buildInstagramCaption(payload: InstagramPublishPayload) {
  const hashtags = formatHashtags(payload.hashtags);
  const caption = [payload.caption, hashtags].filter(Boolean).join("\n\n");

  return truncateCaption(caption);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readGraphJson<TResponse>(response: Response) {
  const data = (await response.json()) as TResponse;

  if (!response.ok) {
    const graphError = data as InstagramErrorResponse;
    throw new Error(
      graphError.error?.message ??
        `Instagram Graph API request failed with status ${response.status}`
    );
  }

  return data;
}

async function createReelContainer({
  accessToken,
  graphVersion,
  igUserId,
  videoUrl,
  caption,
}: {
  accessToken: string;
  graphVersion: string;
  igUserId: string;
  videoUrl: string;
  caption: string;
}) {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${igUserId}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );
  const data = assertNoGraphError(
    await readGraphJson<MediaContainerResponse>(response),
    "Instagram media container creation"
  );

  if (!data.id) {
    throw new Error("Instagram media container creation did not return an id");
  }

  return data.id;
}

async function getContainerStatus({
  accessToken,
  graphVersion,
  containerId,
}: {
  accessToken: string;
  graphVersion: string;
  containerId: string;
}) {
  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/${containerId}`
  );
  url.searchParams.set("fields", "status_code,status");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);

  return assertNoGraphError(
    await readGraphJson<ContainerStatusResponse>(response),
    "Instagram media container status query"
  );
}

async function waitForContainerFinished({
  accessToken,
  graphVersion,
  containerId,
}: {
  accessToken: string;
  graphVersion: string;
  containerId: string;
}) {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const status = await getContainerStatus({
      accessToken,
      graphVersion,
      containerId,
    });

    if (status.status_code === "FINISHED") {
      return status;
    }

    if (status.status_code === "ERROR") {
      throw new Error(
        `Instagram media container processing failed: ${
          status.status ?? "ERROR"
        }`
      );
    }

    if (attempt < POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error("Instagram media container processing timed out");
}

async function publishReelContainer({
  accessToken,
  graphVersion,
  igUserId,
  containerId,
}: {
  accessToken: string;
  graphVersion: string;
  igUserId: string;
  containerId: string;
}) {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );
  const data = assertNoGraphError(
    await readGraphJson<MediaPublishResponse>(response),
    "Instagram media publish"
  );

  if (!data.id) {
    throw new Error("Instagram media publish did not return an id");
  }

  return data.id;
}

export async function publishInstagramReel(
  payload: InstagramPublishPayload,
  target: InstagramPlatformTarget
) {
  void target;

  if (isGoogleDriveUrl(payload.final_video_url)) {
    throw new Error(
      "Instagram Reels requires a clean public MP4 URL. Use Supabase Storage, Cloudflare R2, or another direct public video URL instead of Google Drive."
    );
  }

  const { accessToken, graphVersion, igUserId } = getInstagramConfig();
  const containerId = await createReelContainer({
    accessToken,
    graphVersion,
    igUserId,
    videoUrl: payload.final_video_url,
    caption: buildInstagramCaption(payload),
  });

  await waitForContainerFinished({
    accessToken,
    graphVersion,
    containerId,
  });

  const igMediaId = await publishReelContainer({
    accessToken,
    graphVersion,
    igUserId,
    containerId,
  });

  return {
    platform: "instagram_reels",
    status: "published",
    container_id: containerId,
    ig_media_id: igMediaId,
  };
}
