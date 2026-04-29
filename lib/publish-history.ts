import {
  appendSheetHistoryItem,
  isSheetsHistoryConfigured,
  readSheetHistory,
} from "@/lib/sheets-history";

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

export async function addPublishHistoryItem(item: PublishHistoryItem) {
  const history = getHistoryStore();
  history.unshift(item);
  history.splice(MAX_HISTORY_ITEMS);

  if (!isSheetsHistoryConfigured()) {
    return;
  }

  await appendSheetHistoryItem(item);
}

export async function getPublishHistory() {
  if (!isSheetsHistoryConfigured()) {
    return getHistoryStore();
  }

  try {
    return await readSheetHistory(MAX_HISTORY_ITEMS);
  } catch (error) {
    console.error("Unable to read publish history from Google Sheets", error);
    return getHistoryStore();
  }
}

export function getPublishHistorySource() {
  return isSheetsHistoryConfigured() ? "google_sheets" : "memory";
}
