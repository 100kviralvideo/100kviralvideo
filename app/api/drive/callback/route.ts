import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);

  return NextResponse.json({
    message: "Copy refresh_token into Vercel env GOOGLE_DRIVE_REFRESH_TOKEN",
    refresh_token: tokens.refresh_token,
    access_token_exists: Boolean(tokens.access_token),
    expiry_date: tokens.expiry_date,
  });
}
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);

  return NextResponse.json({
    message: "Copy refresh_token into Vercel env GOOGLE_DRIVE_REFRESH_TOKEN",
    refresh_token: tokens.refresh_token,
    access_token_exists: Boolean(tokens.access_token),
    expiry_date: tokens.expiry_date,
  });
}