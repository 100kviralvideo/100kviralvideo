import { google } from "googleapis";
import type { PublishHistoryItem } from "@/lib/publish-history";

const SHEET_HEADERS = [
  "created_at",
  "job_id",
  "title",
  "final_video_url",
  "duration_sec",
  "ai_generated",
  "status",
  "results_json",
];

function getSheetsConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  ).trim();
  const sheetName = process.env.GOOGLE_SHEETS_HISTORY_SHEET?.trim() || "History";

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

export function isSheetsHistoryConfigured() {
  return Boolean(getSheetsConfig());
}

function createSheetsClient() {
  const config = getSheetsConfig();

  if (!config) {
    throw new Error("Google Sheets history is not configured");
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

async function ensureHeaders() {
  const { sheets, spreadsheetId, sheetName } = createSheetsClient();
  const range = `${sheetName}!A1:H1`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  if (response.data.values?.[0]?.length) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [SHEET_HEADERS],
    },
  });
}

export async function appendSheetHistoryItem(item: PublishHistoryItem) {
  await ensureHeaders();

  const { sheets, spreadsheetId, sheetName } = createSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          item.created_at,
          item.job_id,
          item.title,
          item.final_video_url,
          item.duration_sec ?? "",
          item.ai_generated ?? "",
          item.status,
          JSON.stringify(item.results),
        ],
      ],
    },
  });
}

function parseHistoryRow(row: string[]): PublishHistoryItem | null {
  const [
    createdAt,
    jobId,
    title,
    finalVideoUrl,
    durationSec,
    aiGenerated,
    status,
    resultsJson,
  ] = row;

  if (!createdAt || !jobId || !title || !finalVideoUrl || !status) {
    return null;
  }

  try {
    return {
      created_at: createdAt,
      job_id: jobId,
      title,
      final_video_url: finalVideoUrl,
      duration_sec: durationSec ? Number(durationSec) : undefined,
      ai_generated: aiGenerated === "" ? undefined : aiGenerated === "true",
      status,
      results: resultsJson ? JSON.parse(resultsJson) : [],
    };
  } catch {
    return null;
  }
}

export async function readSheetHistory(limit = 50) {
  await ensureHeaders();

  const { sheets, spreadsheetId, sheetName } = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:H`,
  });
  const rows = response.data.values ?? [];

  return rows
    .map((row) => parseHistoryRow(row as string[]))
    .filter((item): item is PublishHistoryItem => Boolean(item))
    .reverse()
    .slice(0, limit);
}
