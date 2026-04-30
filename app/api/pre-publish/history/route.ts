import { NextResponse } from "next/server";
import {
  isPrePublishQueueConfigured,
  listHistoryPrePublishItems,
} from "@/lib/prepublish-queue";

export const runtime = "nodejs";

export async function GET() {
  if (!isPrePublishQueueConfigured()) {
    return NextResponse.json({
      configured: false,
      items: [],
    });
  }

  try {
    const items = await listHistoryPrePublishItems();

    return NextResponse.json({
      configured: true,
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        configured: true,
        items: [],
        error: error.message ?? "Failed to read pre-publish queue history",
      },
      { status: 500 }
    );
  }
}
