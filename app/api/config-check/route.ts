import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    publisher_api_key_configured: Boolean(process.env.PUBLISHER_API_KEY?.trim()),
    youtube_client_id_configured: Boolean(process.env.YOUTUBE_CLIENT_ID?.trim()),
    youtube_client_secret_configured: Boolean(
      process.env.YOUTUBE_CLIENT_SECRET?.trim()
    ),
    youtube_redirect_uri_configured: Boolean(
      process.env.YOUTUBE_REDIRECT_URI?.trim()
    ),
    youtube_refresh_token_configured: Boolean(
      process.env.YOUTUBE_REFRESH_TOKEN?.trim()
    ),
  });
}
