import { NextRequest, NextResponse } from "next/server";
import { getGoogleDriveTokens } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.json({ error: oauthError }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing OAuth callback code" },
      { status: 400 }
    );
  }

  try {
    const tokens = await getGoogleDriveTokens(code);

    return NextResponse.json({
      message:
        "Copy refresh_token into GOOGLE_DRIVE_REFRESH_TOKEN in Vercel environment variables.",
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
      has_access_token: Boolean(tokens.access_token),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to exchange OAuth code";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
