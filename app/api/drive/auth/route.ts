import { NextResponse } from "next/server";
import { getGoogleDriveAuthUrl } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.redirect(getGoogleDriveAuthUrl());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create Drive auth URL";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
