import { NextRequest, NextResponse } from "next/server";
import { validatePublisherAuth } from "@/lib/api-auth";
import {
  processPublishPayload,
  validatePublishPayload,
} from "@/lib/publisher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!validatePublisherAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, errors } = validatePublishPayload(body);

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body", errors }, { status: 400 });
  }

  if (!payload.human_approved) {
    return NextResponse.json(
      { error: "Human approval is required" },
      { status: 400 }
    );
  }

  if (!payload.rights_cleared) {
    return NextResponse.json(
      { error: "Rights clearance is required" },
      { status: 400 }
    );
  }

  if (!payload.final_video_url) {
    return NextResponse.json(
      { error: "final_video_url is required" },
      { status: 400 }
    );
  }

  return NextResponse.json(await processPublishPayload(payload));
}
