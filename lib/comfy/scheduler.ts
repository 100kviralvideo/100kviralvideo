export type ComfyCompletionCheckPayload = {
  job_id: string;
  prompt_id: string;
  comfy_client_id?: string;
  title?: string;
  attempt?: number;
  secret?: string;
};

function getAppBaseUrl() {
  const explicitUrl = process.env.APP_BASE_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl}`.replace(/\/$/, "");
  }

  return null;
}

export function isComfyQStashSchedulerConfigured() {
  return Boolean(
    process.env.QSTASH_TOKEN?.trim() &&
      process.env.COMFY_WORKER_SECRET?.trim() &&
      getAppBaseUrl()
  );
}

export async function scheduleComfyCompletionCheck(
  payload: Omit<ComfyCompletionCheckPayload, "secret">,
  delay = "1m"
) {
  const token = process.env.QSTASH_TOKEN?.trim();
  const secret = process.env.COMFY_WORKER_SECRET?.trim();
  const baseUrl = getAppBaseUrl();

  if (!token || !secret || !baseUrl) {
    return false;
  }

  const destination = `${baseUrl}/api/comfy/worker/check`;
  const response = await fetch(
    `https://qstash.upstash.io/v2/publish/${encodeURIComponent(destination)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "Upstash-Delay": delay,
      },
      body: JSON.stringify({
        ...payload,
        secret,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `QStash schedule failed: ${response.status} ${response.statusText}`
    );
  }

  return true;
}
