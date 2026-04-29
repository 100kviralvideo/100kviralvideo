export type PlatformHistoryResult = {
  platform: string;
  status: string;
  error?: string;
  video_id?: string;
  youtube_url?: string;
  video_url?: string;
  caption?: string;
  hashtags?: string[];
  [key: string]: unknown;
};

export type PublishHistoryItem = {
  job_id: string;
  title: string;
  final_video_url: string;
  duration_sec?: number;
  ai_generated?: boolean;
  status: string;
  created_at: string;
  results: PlatformHistoryResult[];
};

declare global {
  var publishHistory: PublishHistoryItem[] | undefined;
}

const MAX_HISTORY_ITEMS = 50;

function getHistoryStore() {
  globalThis.publishHistory ??= [];
  return globalThis.publishHistory;
}

export function addPublishHistoryItem(item: PublishHistoryItem) {
  const history = getHistoryStore();
  history.unshift(item);
  history.splice(MAX_HISTORY_ITEMS);
}

export function getPublishHistory() {
  return getHistoryStore();
}
