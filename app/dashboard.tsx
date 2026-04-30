"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrePublishQueueItem } from "@/lib/prepublish-queue";

type PendingResponse = {
  configured: boolean;
  items: PrePublishQueueItem[];
  error?: string;
};

type PlatformName = "youtube_shorts" | "instagram_reels" | "tiktok";

const platformLabels: Record<PlatformName, string> = {
  youtube_shorts: "YouTube Shorts",
  instagram_reels: "Instagram Reels",
  tiktok: "TikTok",
};

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
        <span className="relative">
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

function formatHashtag(hashtag: string) {
  const trimmed = hashtag.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function PendingClipCard({
  item,
  approving,
  onApprove,
}: {
  item: PrePublishQueueItem;
  approving: boolean;
  onApprove: (jobId: string) => void;
}) {
  const hashtags = useMemo(
    () => item.hashtags.map(formatHashtag).filter(Boolean),
    [item.hashtags]
  );

  return (
    <article className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(280px,420px)_1fr]">
      <div className="overflow-hidden rounded bg-zinc-950">
        <video
          className="aspect-[9/16] max-h-[620px] w-full bg-zinc-950 object-contain"
          controls
          preload="metadata"
          src={item.final_video_url}
        />
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
              {item.job_id}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
              {item.title}
            </h2>
          </div>
          <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            waiting approval
          </span>
        </div>

        <dl className="mt-5 grid gap-4 text-sm">
          <div>
            <dt className="font-medium text-zinc-950">Caption</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-700">
              {item.caption}
            </dd>
          </div>

          {item.description ? (
            <div>
              <dt className="font-medium text-zinc-950">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap text-zinc-700">
                {item.description}
              </dd>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-950">Duration</dt>
              <dd className="mt-1 text-zinc-700">
                {item.duration_sec ? `${item.duration_sec}s` : "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-950">Found</dt>
              <dd className="mt-1 text-zinc-700">
                {formatDate(item.created_at)}
              </dd>
            </div>
          </div>

          <div>
            <dt className="font-medium text-zinc-950">Hashtags</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {hashtags.length ? (
                hashtags.map((hashtag) => (
                  <span
                    className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700"
                    key={hashtag}
                  >
                    {hashtag}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500">No hashtags</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-zinc-950">Platforms</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {item.platforms.map((target) => (
                <span
                  className="inline-flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1 text-sm font-medium text-zinc-800"
                  key={`${item.job_id}-${target.platform}`}
                >
                  <PlatformMark platform={target.platform} />
                  {platformLabels[target.platform] ?? target.platform}
                </span>
              ))}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <button
            className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={approving}
            onClick={() => onApprove(item.job_id)}
            type="button"
          >
            {approving ? "Publishing..." : "Approve and publish"}
          </button>
          <a
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            href={item.final_video_url}
            rel="noreferrer"
            target="_blank"
          >
            Open video URL
          </a>
        </div>
      </div>
    </article>
  );
}

export function Dashboard() {
  const [items, setItems] = useState<PrePublishQueueItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadPending() {
    try {
      const response = await fetch("/api/pre-publish/pending", {
        cache: "no-store",
      });
      const data = (await response.json()) as PendingResponse;

      setConfigured(data.configured);
      setItems(data.items ?? []);
      setError(data.error ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load queue"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (!active) {
        return;
      }

      await loadPending();
    }

    refresh();
    const interval = window.setInterval(refresh, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function approve(jobId: string) {
    setApprovingJobId(jobId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/pre-publish/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Publish failed");
      }

      setMessage(`Published ${jobId}`);
      await loadPending();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Publish failed"
      );
    } finally {
      setApprovingJobId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Publisher API</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              Clips Waiting For Approval
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              href="/docs"
            >
              Swagger
            </a>
            <a
              className="rounded border border-zinc-900 bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              href="/api/config-check"
            >
              Config
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        {message ? (
          <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}

        {!configured ? (
          <section className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center">
            <h2 className="text-lg font-semibold text-zinc-950">
              Pre-publish queue is not configured
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Add the Google Sheets environment variables and use a
              PrePublishQueue tab in the same spreadsheet.
            </p>
          </section>
        ) : loading ? (
          <section className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center text-sm font-medium text-zinc-500">
            Loading clips...
          </section>
        ) : items.length === 0 ? (
          <section className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center">
            <h2 className="text-lg font-semibold text-zinc-950">
              No clips are waiting for approval
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              New items will appear here after /api/pre-publish finds the final
              Drive video.
            </p>
          </section>
        ) : (
          <section className="grid gap-5">
            {items.map((item) => (
              <PendingClipCard
                approving={approvingJobId === item.job_id}
                item={item}
                key={`${item.job_id}-${item.created_at}`}
                onApprove={approve}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
