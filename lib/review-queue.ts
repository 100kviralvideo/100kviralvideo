export type ReviewQueuePlatform =
  | { platform: "youtube_shorts"; privacy?: "private" | "public" | "unlisted" }
  | { platform: "instagram_reels" }
  | { platform: "tiktok" };

export type ReviewQueueItem = {
  id: string;
  folder_id: string;
  video_filename: string;
  title: string;
  caption: string;
  description: string;
  hashtags: string[];
  duration_sec: number;
  ai_generated: boolean;
  platforms: ReviewQueuePlatform[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlatform(value: unknown): value is ReviewQueuePlatform {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.platform === "youtube_shorts" ||
    value.platform === "instagram_reels" ||
    value.platform === "tiktok"
  );
}

function isReviewQueueItem(value: unknown): value is ReviewQueueItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.folder_id === "string" &&
    typeof value.video_filename === "string" &&
    typeof value.title === "string" &&
    typeof value.caption === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.hashtags) &&
    value.hashtags.every((hashtag) => typeof hashtag === "string") &&
    typeof value.duration_sec === "number" &&
    typeof value.ai_generated === "boolean" &&
    Array.isArray(value.platforms) &&
    value.platforms.every(isPlatform)
  );
}

export function getReviewQueue() {
  const rawQueue = process.env.REVIEW_QUEUE_JSON?.trim();

  if (!rawQueue) {
    return [];
  }

  const parsed = JSON.parse(rawQueue) as unknown;

  if (!Array.isArray(parsed) || !parsed.every(isReviewQueueItem)) {
    throw new Error("REVIEW_QUEUE_JSON must be an array of review queue items");
  }

  return parsed;
}

export function getReviewQueueItem(id: string) {
  return getReviewQueue().find((item) => item.id === id) ?? null;
}
