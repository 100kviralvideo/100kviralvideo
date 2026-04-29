import { NextRequest, NextResponse } from "next/server";
import { exchangeTikTokCode } from "@/lib/tiktok";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  const oauthErrorDescription = req.nextUrl.searchParams.get("error_description");

  if (oauthError) {
    return NextResponse.json(
      { error: oauthError, error_description: oauthErrorDescription },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing TikTok OAuth callback code" },
      { status: 400 }
    );
  }

  try {
    const tokens = await exchangeTikTokCode(code);

    return NextResponse.json({
      message:
        "Copy refresh_token into TIKTOK_REFRESH_TOKEN in Vercel environment variables.",
      access_token_exists: Boolean(tokens.access_token),
      open_id: tokens.open_id,
      scope: tokens.scope,
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to exchange TikTok OAuth code";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
