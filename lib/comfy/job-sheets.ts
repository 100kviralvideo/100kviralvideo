import { google } from "googleapis";
import type { ComfyJobRecord } from "@/lib/comfy/jobs";

const SHEET_HEADERS = [
  "job_id",
  "title",
  "created_at",
  "updated_at",
  "record_json",
];

type SheetRow = {
  rowNumber: number;
  record: ComfyJobRecord;
};

const DEFAULT_ROWS_CACHE_MS = 15_000;

let sheetReady = false;
let ensureSheetPromise: Promise<void> | null = null;
let rowsCache: { rows: SheetRow[]; expiresAt: number } | null = null;
let rowsReadPromise: Promise<SheetRow[]> | null = null;

function getRowsCacheMs() {
  const value = Number(process.env.GOOGLE_SHEETS_CACHE_MS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_ROWS_CACHE_MS;
}

function getSheetsConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  ).trim();
  const sheetName = process.env.COMFY_JOBS_SHEET?.trim() || "ComfyJobs";

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

export function isComfyJobsSheetConfigured() {
  return Boolean(getSheetsConfig());
}

function createSheetsClient() {
  const config = getSheetsConfig();

  if (!config) {
    throw new Error(
      "Google Sheets Comfy jobs storage is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_CLIENT_EMAIL, and GOOGLE_SHEETS_PRIVATE_KEY."
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

function isComfyJobRecord(value: unknown): value is ComfyJobRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { job_id?: unknown }).job_id === "string" &&
    typeof (value as { status?: unknown }).status === "string" &&
    typeof (value as { created_at?: unknown }).created_at === "string" &&
    typeof (value as { updated_at?: unknown }).updated_at === "string"
  );
}

async function ensureSheetAndHeaders() {
  if (sheetReady) {
    return;
  }

  if (ensureSheetPromise) {
    return ensureSheetPromise;
  }

  ensureSheetPromise = ensureSheetAndHeadersUncached()
    .then(() => {
      sheetReady = true;
    })
    .finally(() => {
      ensureSheetPromise = null;
    });

  return ensureSheetPromise;
}

async function ensureSheetAndHeadersUncached() {
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

  const headerRange = `${quoteSheetName(sheetName)}!A1:E1`;
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
      values: [SHEET_HEADERS],
    },
  });
}

function parseRow(row: string[], index: number): SheetRow | null {
  const [, , , , recordJson] = row;

  if (!recordJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(recordJson) as unknown;
    return isComfyJobRecord(parsed)
      ? { rowNumber: index + 2, record: parsed }
      : null;
  } catch {
    return null;
  }
}

async function readRows({ ensureHeaders = true } = {}) {
  if (!isComfyJobsSheetConfigured()) {
    return [];
  }

  const now = Date.now();
  if (rowsCache && rowsCache.expiresAt > now) {
    return rowsCache.rows;
  }

  if (rowsReadPromise) {
    return rowsReadPromise;
  }

  rowsReadPromise = readRowsUncached(ensureHeaders)
    .catch((error) => {
      if (rowsCache) {
        return rowsCache.rows;
      }

      throw error;
    })
    .finally(() => {
      rowsReadPromise = null;
    });

  return rowsReadPromise;
}

async function readRowsUncached(ensureHeaders: boolean) {
  if (ensureHeaders) {
    await ensureSheetAndHeaders();
  }

  const { sheets, spreadsheetId, sheetName } = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A2:E`,
  });
  const rows = response.data.values ?? [];

  const parsedRows = rows
    .map((row, index) => parseRow(row as string[], index))
    .filter((row): row is SheetRow => Boolean(row));

  rowsCache = {
    rows: parsedRows,
    expiresAt: Date.now() + getRowsCacheMs(),
  };

  return parsedRows;
}

function rowValues(job: ComfyJobRecord) {
  return [
    job.job_id,
    job.title ?? "",
    job.created_at,
    job.updated_at,
    JSON.stringify(job),
  ];
}

export async function upsertSheetComfyJob(job: ComfyJobRecord) {
  if (!isComfyJobsSheetConfigured()) {
    return;
  }

  await ensureSheetAndHeaders();

  const rows = await readRows({ ensureHeaders: false });
  const existing = [...rows].reverse().find(
    (row) => row.record.job_id === job.job_id
  );
  const { sheets, spreadsheetId, sheetName } = createSheetsClient();

  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A${existing.rowNumber}:E${existing.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues(job)],
      },
    });
    rowsCache = {
      rows: rows.map((row) =>
        row.rowNumber === existing.rowNumber ? { ...row, record: job } : row
      ),
      expiresAt: Date.now() + getRowsCacheMs(),
    };
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A:E`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowValues(job)],
    },
  });
  rowsCache = null;
}

export async function getSheetComfyJob(jobId: string) {
  const rows = await readRows();
  return (
    [...rows].reverse().find((row) => row.record.job_id === jobId)?.record ??
    null
  );
}

export async function listSheetComfyJobs() {
  const rows = await readRows();
  return rows.map((row) => row.record);
}
