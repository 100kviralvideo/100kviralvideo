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
    tiktok_client_key_configured: Boolean(
      process.env.TIKTOK_CLIENT_KEY?.trim()
    ),
    tiktok_client_secret_configured: Boolean(
      process.env.TIKTOK_CLIENT_SECRET?.trim()
    ),
    tiktok_redirect_uri_configured: Boolean(
      process.env.TIKTOK_REDIRECT_URI?.trim()
    ),
    tiktok_refresh_token_configured: Boolean(
      process.env.TIKTOK_REFRESH_TOKEN?.trim()
    ),
    meta_access_token_configured: Boolean(
      process.env.META_ACCESS_TOKEN?.trim()
    ),
    ig_user_id_configured: Boolean(process.env.IG_USER_ID?.trim()),
    meta_graph_version: process.env.META_GRAPH_VERSION?.trim() || "v25.0",
    google_sheets_spreadsheet_id_configured: Boolean(
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()
    ),
    google_sheets_client_email_configured: Boolean(
      process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim()
    ),
    google_sheets_private_key_configured: Boolean(
      process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim()
    ),
    google_sheets_history_sheet:
      process.env.GOOGLE_SHEETS_HISTORY_SHEET?.trim() || "History",
    google_drive_client_email_configured: Boolean(
      process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim()
    ),
    google_drive_private_key_configured: Boolean(
      process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim()
    ),
    comfy_url_configured: Boolean(process.env.COMFY_URL?.trim()),
    comfy_workflow_path: process.env.WORKFLOW_PATH?.trim() || "workflows/workflow_api.json",
    comfy_upload_to_drive: process.env.UPLOAD_TO_DRIVE?.trim() || "true",
    comfy_google_drive_folder_id_configured: Boolean(
      process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
    ),
  });
}
