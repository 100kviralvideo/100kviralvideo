import { NextRequest, NextResponse } from "next/server";
import { updatePrePublishDetails } from "@/lib/prepublish-queue";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.job_id) {
    return NextResponse.json({ error: "job_id is required" }, { status: 400 });
  }

  try {
    const updated = await updatePrePublishDetails(body.job_id, {
      title: body.title,
      caption: body.caption,
      description: body.description,
      hashtags: body.hashtags,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Failed to update item" },
      { status: 500 }
    );
  }
}
