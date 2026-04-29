import { NextResponse } from "next/server";
import {
  getPublishHistory,
  getPublishHistorySource,
} from "@/lib/publish-history";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    source: getPublishHistorySource(),
    history: await getPublishHistory(),
  });
}
