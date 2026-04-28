import { NextResponse } from "next/server";
import { getYouTubeAuthUrl } from "@/lib/youtube";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.redirect(getYouTubeAuthUrl());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create auth URL";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
