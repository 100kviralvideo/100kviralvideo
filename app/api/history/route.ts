import { NextResponse } from "next/server";
import { getPublishHistory } from "@/lib/publish-history";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    history: getPublishHistory(),
  });
}
