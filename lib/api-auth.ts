import type { NextRequest } from "next/server";

export function validatePublisherAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization")?.trim();
  const publisherApiKey = process.env.PUBLISHER_API_KEY?.trim();

  return Boolean(
    publisherApiKey && authHeader === `Bearer ${publisherApiKey}`
  );
}
