"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublishHistoryItem } from "@/lib/publish-history";

type ConfigStatus = {
  publisher_api_key_configured: boolean;
  youtube_client_id_configured: boolean;
  youtube_client_secret_configured: boolean;
  youtube_redirect_uri_configured: boolean;
  youtube_refresh_token_configured: boolean;
};

type PlatformName = "youtube_shorts" | "instagram_reels" | "tiktok";

type DriveVideoResult = {
  file_id: string;
  name: string;
  mime_type?: string;
  size?: string;
  created_time?: string;
  web_view_link?: string;
  final_video_url: string;
  warning?: string | null;
};

type ReviewClip = {
  id: string;
  title: string;
  caption: string;
  description: string;
  hashtags: string[];
  duration_sec: number;
  ai_generated: boolean;
  platforms: Array<{ platform: PlatformName; privacy?: string }>;
  drive_video: DriveVideoResult;
};

const platforms: Array<{ id: PlatformName; label: string; accent: string }> = [
  { id: "youtube_shorts", label: "YouTube Shorts", accent: "bg-red-600" },
  {
    id: "instagram_reels",
    label: "Instagram Reels",
    accent: "bg-fuchsia-600",
  },
  { id: "tiktok", label: "TikTok", accent: "bg-zinc-950" },
];

const statusStyles: Record<string, string> = {
  uploaded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  processed: "bg-sky-50 text-sky-700 ring-sky-200",
  needs_manual_action: "bg-amber-50 text-amber-800 ring-amber-200",
  not_implemented_yet: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ring-1 ring-inset ${
        statusStyles[status] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PlatformMark({ platform }: { platform: string }) {
  if (platform === "youtube_shorts") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-red-600 text-white shadow-sm">
        <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
      </span>
    );
  }

  if (platform === "instagram_reels") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[linear-gradient(135deg,#f97316,#db2777,#4f46e5)] text-white shadow-sm">
        <span className="relative h-5 w-5 rounded border-2 border-white">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white" />
          <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-white" />
        </span>
      </span>
    );
  }

  if (platform === "tiktok") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-zinc-950 text-lg font-black text-white shadow-sm">
        <span className="relative font-black">
          <span className="absolute -left-0.5 top-0 text-cyan-300">T</span>
          <span className="absolute left-0.5 top-0 text-rose-400">T</span>
          <span className="relative">T</span>
        </span>
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-zinc-200 text-xs font-semibold text-zinc-600">
      API
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function countPlatformJobs(history: PublishHistoryItem[], platform: PlatformName) {
  return history.reduce((count, job) => {
    return count + job.results.filter((result) => result.platform === platform).length;
  }, 0);
}

function countPlatformFailures(
  history: PublishHistoryItem[],
  platform: PlatformName
) {
  return history.reduce((count, job) => {
    return (
      count +
      job.results.filter(
        (result) => result.platform === platform && result.status === "failed"
      ).length
    );
  }, 0);
}

async function readJsonResponse(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export function Dashboard() {
  const [history, setHistory] = useState<PublishHistoryItem[]>([]);
  const [historySource, setHistorySource] = useState("memory");
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewClips, setReviewClips] = useState<ReviewClip[]>([]);
  const [reviewQueueConfigured, setReviewQueueConfigured] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [approvingClipId, setApprovingClipId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [historyResponse, configResponse, reviewResponse] =
          await Promise.all([
          fetch("/api/history", { cache: "no-store" }),
          fetch("/api/config-check", { cache: "no-store" }),
          fetch("/api/review/pending", { cache: "no-store" }),
        ]);
        const historyData = (await historyResponse.json()) as {
          source?: string;
          history?: PublishHistoryItem[];
        };
        const configData = (await configResponse.json()) as ConfigStatus;
        const reviewData = (await reviewResponse.json()) as {
          configured?: boolean;
          clips?: ReviewClip[];
        };

        if (active) {
          setHistory(historyData.history ?? []);
          setHistorySource(historyData.source ?? "memory");
          setConfig(configData);
          setReviewQueueConfigured(Boolean(reviewData.configured));
          setReviewClips(reviewData.clips ?? []);
        }
      } finally {
        if (active) {
          setLoading(false);
          setReviewLoading(false);
        }
      }
    }

    loadDashboard();
    const interval = window.setInterval(loadDashboard, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function refreshHistory() {
    const historyResponse = await fetch("/api/history", { cache: "no-store" });
    const historyData = (await historyResponse.json()) as {
      source?: string;
      history?: PublishHistoryItem[];
    };

    setHistory(historyData.history ?? []);
    setHistorySource(historyData.source ?? "memory");
  }

  async function refreshReviewQueue() {
    const reviewResponse = await fetch("/api/review/pending", {
      cache: "no-store",
    });
    const reviewData = (await reviewResponse.json()) as {
      configured?: boolean;
      clips?: ReviewClip[];
    };

    setReviewQueueConfigured(Boolean(reviewData.configured));
    setReviewClips(reviewData.clips ?? []);
  }

  async function approveClip(clipId: string) {
    setApprovingClipId(clipId);
    setWorkflowError(null);
    setWorkflowMessage(null);

    try {
      const data = await readJsonResponse(
        await fetch("/api/review/approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: clipId }),
        })
      );

      setWorkflowMessage(`Publish processed for ${data.job_id}.`);
      await refreshHistory();
      await refreshReviewQueue();
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setApprovingClipId(null);
    }
  }

  const totalResults = useMemo(
    () => history.reduce((count, job) => count + job.results.length, 0),
    [history]
  );
  const failedResults = useMemo(
    () =>
      history.reduce(
        (count, job) =>
          count + job.results.filter((result) => result.status === "failed").length,
        0
      ),
    [history]
  );
  const youtubeReady = Boolean(
    config?.youtube_client_id_configured &&
      config.youtube_client_secret_configured &&
      config.youtube_redirect_uri_configured &&
      config.youtube_refresh_token_configured
  );

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Publisher API</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              Clip Publishing Dashboard
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              href="/terms"
            >
              Terms
            </a>
            <a
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              href="/privacy"
            >
              Privacy
            </a>
            <a
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              href="/docs"
            >
              Open Swagger
            </a>
            <a
              className="rounded border border-zinc-900 bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              href="/api/config-check"
            >
              Config Check
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Recent jobs</p>
            <p className="mt-2 text-3xl font-semibold">{history.length}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Platform actions</p>
            <p className="mt-2 text-3xl font-semibold">{totalResults}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Failed actions</p>
            <p className="mt-2 text-3xl font-semibold">{failedResults}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">YouTube OAuth</p>
            <p className="mt-3">
              <StatusBadge status={youtubeReady ? "processed" : "failed"} />
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {platforms.map((platform) => {
            const total = countPlatformJobs(history, platform.id);
            const failures = countPlatformFailures(history, platform.id);

            return (
              <div
                className="rounded-lg border border-zinc-200 bg-white p-4"
                key={platform.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PlatformMark platform={platform.id} />
                    <div>
                      <h2 className="text-base font-semibold">
                        {platform.label}
                      </h2>
                      <div className={`mt-1 h-1 w-10 rounded ${platform.accent}`} />
                    </div>
                  </div>
                  <StatusBadge
                    status={failures > 0 ? "failed" : total > 0 ? "processed" : "not_implemented_yet"}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-zinc-500">Actions</dt>
                    <dd className="mt-1 text-xl font-semibold">{total}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Failures</dt>
                    <dd className="mt-1 text-xl font-semibold">{failures}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Awaiting Approval</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Ready clips appear here after the Drive upload is complete and
                the final video URL has been resolved automatically.
              </p>
            </div>
            <button
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={refreshReviewQueue}
              type="button"
            >
              Refresh queue
            </button>
          </div>

          {reviewLoading ? (
            <div className="px-4 py-10 text-sm text-zinc-500">
              Checking Drive for completed videos.
            </div>
          ) : !reviewQueueConfigured ? (
            <div className="px-4 py-10 text-sm text-zinc-500">
              No review queue is configured yet. Add pending clips to
              `REVIEW_QUEUE_JSON` when the real Drive folder and filename are
              ready.
            </div>
          ) : reviewClips.length === 0 ? (
            <div className="px-4 py-10 text-sm text-zinc-500">
              No uploaded videos are ready for approval yet.
            </div>
          ) : (
            <div className="grid gap-4 p-4 xl:grid-cols-2">
              {reviewClips.map((clip) => (
                <article
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                  key={clip.id}
                >
                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <video
                      className="aspect-[9/16] w-full rounded bg-black object-cover"
                      controls
                      preload="metadata"
                      src={clip.drive_video.final_video_url}
                    />
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-emerald-700">
                          Ready for human approval
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                          {clip.title}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">{clip.id}</p>
                      </div>

                      <p className="text-sm leading-6 text-zinc-700">
                        {clip.caption}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {clip.description}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {clip.hashtags.map((hashtag) => (
                          <span
                            className="rounded bg-white px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200"
                            key={hashtag}
                          >
                            #{hashtag.replace(/^#/, "")}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {clip.platforms.map((target) => (
                          <span
                            className="inline-flex items-center gap-2 rounded bg-white px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200"
                            key={target.platform}
                          >
                            <PlatformMark platform={target.platform} />
                            {target.platform.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>

                      <div className="rounded border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                        <p className="font-medium text-zinc-700">
                          {clip.drive_video.name}
                        </p>
                        <p className="mt-1 break-all">
                          {clip.drive_video.final_video_url}
                        </p>
                      </div>

                      <button
                        className="rounded border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                        disabled={approvingClipId === clip.id}
                        onClick={() => approveClip(clip.id)}
                        type="button"
                      >
                        {approvingClipId === clip.id
                          ? "Publishing"
                          : "Approve and publish"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {(workflowMessage || workflowError) && (
            <div className="border-t border-zinc-200 px-4 py-3">
              {workflowMessage ? (
                <span className="text-sm font-medium text-emerald-700">
                  {workflowMessage}
                </span>
              ) : null}
              {workflowError ? (
                <span className="text-sm font-medium text-rose-700">
                  {workflowError}
                </span>
              ) : null}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <h2 className="text-base font-semibold">Clip History</h2>
            <span className="text-sm text-zinc-500">
              {loading
                ? "Loading"
                : `Source: ${historySource.replaceAll("_", " ")}. Refreshes every 10 seconds`}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-base font-medium text-zinc-900">
                No publish jobs recorded yet.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Send a request to /api/publish and the latest results will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-normal text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Clip</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Platforms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.map((job) => (
                    <tr key={`${job.job_id}-${job.created_at}`}>
                      <td className="max-w-sm px-4 py-4 align-top">
                        <p className="font-medium text-zinc-950">{job.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{job.job_id}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-600">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-600">
                        {job.duration_sec ? `${job.duration_sec}s` : "Unknown"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          {job.results.map((result, index) => (
                            <div
                              className="flex flex-wrap items-center gap-2"
                              key={`${result.platform}-${index}`}
                            >
                              <PlatformMark platform={result.platform} />
                              <span className="min-w-32 font-medium capitalize text-zinc-800">
                                {result.platform.replaceAll("_", " ")}
                              </span>
                              <StatusBadge status={result.status} />
                              {result.youtube_url ? (
                                <a
                                  className="text-xs font-medium text-sky-700 hover:text-sky-900"
                                  href={result.youtube_url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  View video
                                </a>
                              ) : null}
                              {result.error ? (
                                <span className="text-xs text-rose-700">
                                  {result.error}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
