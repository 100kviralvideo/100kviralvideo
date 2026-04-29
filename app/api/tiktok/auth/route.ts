import { NextResponse } from "next/server";
import { getTikTokAuthUrl } from "@/lib/tiktok";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.redirect(getTikTokAuthUrl());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create TikTok auth URL";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
