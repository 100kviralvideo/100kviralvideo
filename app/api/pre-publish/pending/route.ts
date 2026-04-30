import { NextResponse } from "next/server";
import {
  isPrePublishQueueConfigured,
  listPendingPrePublishItems,
} from "@/lib/prepublish-queue";

export const runtime = "nodejs";

export async function GET() {
  if (!isPrePublishQueueConfigured()) {
    return NextResponse.json({
      configured: false,
      items: [],
      error:
        "Google Sheets pre-publish queue is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_CLIENT_EMAIL, and GOOGLE_SHEETS_PRIVATE_KEY.",
    });
  }

  try {
    return NextResponse.json({
      configured: true,
      items: await listPendingPrePublishItems(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        configured: true,
        items: [],
        error: message,
      },
      { status: 500 }
    );
  }
}
