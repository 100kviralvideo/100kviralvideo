import { google } from "googleapis";
import type { DriveVideoLookupResult } from "@/lib/google-drive";
import type { PlatformTarget, PublishPayload } from "@/lib/publisher";

const QUEUE_HEADERS = [
  "created_at",
  "updated_at",
  "job_id",
  "status",
  "folder_id",
  "video_filename",
  "final_video_url",
  "drive_file_json",
  "title",
  "caption",
  "description",
  "hashtags_json",
  "duration_sec",
  "ai_generated",
  "platforms_json",
  "publish_result_json",
  "error",
];

export type PrePublishStatus = "pending" | "publishing" | "published" | "failed";

export type PrePublishQueueItem = {
  created_at: string;
  updated_at: string;
  job_id: string;
  status: PrePublishStatus;
  folder_id: string;
  video_filename: string;
  final_video_url: string;
  drive_file: DriveVideoLookupResult;
  title: string;
  caption: string;
  description: string;
  hashtags: string[];
  duration_sec: number;
  ai_generated: boolean;
  platforms: PlatformTarget[];
  publish_result?: unknown;
  error?: string;
};

type QueueRow = PrePublishQueueItem & {
  rowNumber: number;
};

type SavePrePublishInput = {
  folder_id: string;
  video_filename: string;
  drive_file: DriveVideoLookupResult;
  payload: PublishPayload;
};

function getSheetsConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  ).trim();
  const sheetName =
    process.env.PREPUBLISH_QUEUE_SHEET?.trim() || "PrePublishQueue";

  if (!spreadsheetId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    spreadsheetId,
    clientEmail,
    privateKey,
    sheetName,
  };
}

export function isPrePublishQueueConfigured() {
  return Boolean(getSheetsConfig());
}

function createSheetsClient() {
  const config = getSheetsConfig();

  if (!config) {
    throw new Error(
      "Google Sheets pre-publish queue is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_CLIENT_EMAIL, and GOOGLE_SHEETS_PRIVATE_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    spreadsheetId: config.spreadsheetId,
    sheetName: config.sheetName,
    sheets: google.sheets({ version: "v4", auth }),
  };
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

async function ensureQueueSheetAndHeaders() {
  const { sheets, spreadsheetId, sheetName } = createSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const sheetExists = spreadsheet.data.sheets?.some(
    (sheet) => sheet.properties?.title === sheetName
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
  }

  const quotedSheetName = quoteSheetName(sheetName);
  const headerRange = `${quotedSheetName}!A1:Q1`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  });

  if (response.data.values?.[0]?.length) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: headerRange,
    valueInputOption: "RAW",
    requestBody: {
      values: [QUEUE_HEADERS],
    },
  });
}

function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseQueueRow(row: string[], index: number): QueueRow | null {
  const [
    createdAt,
    updatedAt,
    jobId,
    status,
    folderId,
    videoFilename,
    finalVideoUrl,
    driveFileJson,
    title,
    caption,
    description,
    hashtagsJson,
    durationSec,
    aiGenerated,
    platformsJson,
    publishResultJson,
    error,
  ] = row;

  if (!createdAt || !jobId || !status || !finalVideoUrl || !title) {
    return null;
  }

  if (
    status !== "pending" &&
    status !== "publishing" &&
    status !== "published" &&
    status !== "failed"
  ) {
    return null;
  }

  return {
    rowNumber: index + 2,
    created_at: createdAt,
    updated_at: updatedAt || createdAt,
    job_id: jobId,
    status,
    folder_id: folderId || "",
    video_filename: videoFilename || "",
    final_video_url: finalVideoUrl,
    drive_file: safeJsonParse(driveFileJson, {
      success: true,
      file_id: "",
      final_video_url: finalVideoUrl,
      warning: null,
    }),
    title,
    caption: caption || "",
    description: description || "",
    hashtags: safeJsonParse<string[]>(hashtagsJson, []),
    duration_sec: durationSec ? Number(durationSec) : 0,
    ai_generated: aiGenerated === "true",
    platforms: safeJsonParse<PlatformTarget[]>(platformsJson, []),
    publish_result: safeJsonParse<unknown>(publishResultJson, undefined),
    error: error || undefined,
  };
}

async function readQueueRows() {
  await ensureQueueSheetAndHeaders();

  const { sheets, spreadsheetId, sheetName } = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A2:Q`,
  });
  const rows = response.data.values ?? [];

  return rows
    .map((row, index) => parseQueueRow(row as string[], index))
    .filter((item): item is QueueRow => Boolean(item));
}

function rowValues(item: PrePublishQueueItem) {
  return [
    item.created_at,
    item.updated_at,
    item.job_id,
    item.status,
    item.folder_id,
    item.video_filename,
    item.final_video_url,
    JSON.stringify(item.drive_file),
    item.title,
    item.caption,
    item.description,
    JSON.stringify(item.hashtags),
    item.duration_sec,
    item.ai_generated,
    JSON.stringify(item.platforms),
    item.publish_result ? JSON.stringify(item.publish_result) : "",
    item.error ?? "",
  ];
}

export async function savePrePublishItem(input: SavePrePublishInput) {
  await ensureQueueSheetAndHeaders();

  const now = new Date().toISOString();
  const existing = [...(await readQueueRows())]
    .reverse()
    .find((item) => item.job_id === input.payload.job_id);
  const item: PrePublishQueueItem = {
    created_at: existing?.created_at ?? now,
    updated_at: now,
    job_id: input.payload.job_id,
    status: "pending",
    folder_id: input.folder_id,
    video_filename: input.video_filename,
    final_video_url: input.drive_file.final_video_url,
    drive_file: input.drive_file,
    title: input.payload.title,
    caption: input.payload.caption,
    description: input.payload.description ?? "",
    hashtags: input.payload.hashtags ?? [],
    duration_sec: input.payload.duration_sec ?? 0,
    ai_generated: input.payload.ai_generated ?? true,
    platforms: input.payload.platforms,
    publish_result: undefined,
    error: undefined,
  };

  const { sheets, spreadsheetId, sheetName } = createSheetsClient();

  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A${existing.rowNumber}:Q${existing.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues(item)],
      },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [rowValues(item)],
      },
    });
  }

  return item;
}

export async function listPendingPrePublishItems() {
  const rows = await readQueueRows();

  return rows
    .filter((item) => item.status === "pending")
    .map((row) => ({
      created_at: row.created_at,
      updated_at: row.updated_at,
      job_id: row.job_id,
      status: row.status,
      folder_id: row.folder_id,
      video_filename: row.video_filename,
      final_video_url: row.final_video_url,
      drive_file: row.drive_file,
      title: row.title,
      caption: row.caption,
      description: row.description,
      hashtags: row.hashtags,
      duration_sec: row.duration_sec,
      ai_generated: row.ai_generated,
      platforms: row.platforms,
      publish_result: row.publish_result,
      error: row.error,
    }))
    .reverse();
}

export async function listHistoryPrePublishItems() {
  const rows = await readQueueRows();

  return rows
    .filter((item) => item.status !== "pending")
    .map((row) => ({
      created_at: row.created_at,
      updated_at: row.updated_at,
      job_id: row.job_id,
      status: row.status,
      folder_id: row.folder_id,
      video_filename: row.video_filename,
      final_video_url: row.final_video_url,
      drive_file: row.drive_file,
      title: row.title,
      caption: row.caption,
      description: row.description,
      hashtags: row.hashtags,
      duration_sec: row.duration_sec,
      ai_generated: row.ai_generated,
      platforms: row.platforms,
      publish_result: row.publish_result,
      error: row.error,
    }))
    .reverse();
}

export async function getLatestPrePublishItem(jobId: string) {
  const rows = await readQueueRows();
  const item = [...rows].reverse().find((row) => row.job_id === jobId);

  if (!item) {
    return null;
  }

  const { rowNumber, ...queueItem } = item;

  return {
    rowNumber,
    item: queueItem,
  };
}

export async function updatePrePublishStatus(
  jobId: string,
  update: {
    status: PrePublishStatus;
    publish_result?: unknown;
    error?: string;
  }
) {
  const current = await getLatestPrePublishItem(jobId);

  if (!current) {
    throw new Error(`No pre-publish queue item found for job_id "${jobId}"`);
  }

  const next: PrePublishQueueItem = {
    ...current.item,
    updated_at: new Date().toISOString(),
    status: update.status,
    publish_result: update.publish_result ?? current.item.publish_result,
    error: update.error,
  };
  const { sheets, spreadsheetId, sheetName } = createSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A${current.rowNumber}:Q${current.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [rowValues(next)],
    },
  });

  return next;
}

export async function updatePrePublishDetails(
  jobId: string,
  update: {
    title?: string;
    caption?: string;
    description?: string;
    hashtags?: string[];
  }
) {
  const current = await getLatestPrePublishItem(jobId);

  if (!current) {
    throw new Error(`No pre-publish queue item found for job_id "${jobId}"`);
  }

  const next: PrePublishQueueItem = {
    ...current.item,
    updated_at: new Date().toISOString(),
    title: update.title ?? current.item.title,
    caption: update.caption ?? current.item.caption,
    description: update.description ?? current.item.description,
    hashtags: update.hashtags ?? current.item.hashtags,
  };
  const { sheets, spreadsheetId, sheetName } = createSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A${current.rowNumber}:Q${current.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [rowValues(next)],
    },
  });

  return next;
}
