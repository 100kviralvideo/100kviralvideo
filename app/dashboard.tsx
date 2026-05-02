"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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

function PlatformMark({ platform, small }: { platform: string; small?: boolean }) {
  const sizeClass = small ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs";

  if (platform === "youtube_shorts") {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded bg-red-600 text-white shadow-sm ${sizeClass}`}>
        <span className={small ? "ml-[1px] h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-white" : "ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white"} />
      </span>
    );
  }

  if (platform === "instagram_reels") {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded bg-[linear-gradient(135deg,#f97316,#db2777,#4f46e5)] text-white shadow-sm ${sizeClass}`}>
        <span className={`relative rounded border-2 border-white ${small ? "h-3.5 w-3.5 border-[1.5px]" : "h-5 w-5 border-2"}`}>
          <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${small ? "h-1 w-1" : "h-1.5 w-1.5"}`} />
          <span className={`absolute right-[1px] top-[1px] rounded-full bg-white ${small ? "h-[2px] w-[2px]" : "h-1 w-1"}`} />
        </span>
      </span>
    );
  }

  if (platform === "tiktok") {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded bg-zinc-950 font-black text-white shadow-sm ${sizeClass} ${small ? "text-[10px]" : "text-lg"}`}>
        <span className="relative">
          <span className="absolute -left-0.5 top-0 text-cyan-300">T</span>
          <span className="absolute left-0.5 top-0 text-rose-400">T</span>
          <span className="relative">T</span>
        </span>
      </span>
    );
  }

  return (
    <span className={`flex shrink-0 items-center justify-center rounded bg-zinc-200 font-semibold text-zinc-600 ${sizeClass}`}>
      API
    </span>
  );
}

function StatusBadge({ status }: { status: PrePublishQueueItem["status"] }) {
  const styles = {
    published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    failed: "bg-rose-50 text-rose-800 ring-rose-200",
    publishing: "bg-blue-50 text-blue-800 ring-blue-200",
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
        styles[status] || "bg-zinc-50 text-zinc-800 ring-zinc-200"
      }`}
    >
      {status}
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
  denying,
  onApprove,
  onDeny,
  onUpdate,
}: {
  item: PrePublishQueueItem;
  approving: boolean;
  denying: boolean;
  onApprove: (jobId: string, privacy: string) => void;
  onDeny: (jobId: string) => void;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editCaption, setEditCaption] = useState(item.caption);
  const [editDescription, setEditDescription] = useState(item.description);
  const [editHashtags, setEditHashtags] = useState(item.hashtags.join(" "));
  const [privacy, setPrivacy] = useState("public");

  const hashtags = useMemo(
    () => item.hashtags.map(formatHashtag).filter(Boolean),
    [item.hashtags]
  );

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/pre-publish/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: item.job_id,
          title: editTitle,
          caption: editCaption,
          description: editDescription,
          hashtags: editHashtags.split(/\s+/).filter(Boolean).map(formatHashtag),
        }),
      });
      if (response.ok) {
        setIsEditing(false);
        onUpdate();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update");
      }
    } catch (e: any) {
      alert(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditTitle(item.title);
    setEditCaption(item.caption);
    setEditDescription(item.description);
    setEditHashtags(item.hashtags.join(" "));
    setIsEditing(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] items-start">
      <div className="overflow-hidden rounded bg-zinc-950">
        <iframe
          allow="autoplay; fullscreen"
          className="aspect-[9/16] max-h-[620px] w-full border-0 bg-zinc-950 object-contain"
          src={
            item.drive_file?.web_view_link
              ? item.drive_file.web_view_link.replace(/\/view.*/, "/preview")
              : item.final_video_url
          }
        />
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-normal text-zinc-500">
              {item.job_id}
            </p>
            {isEditing ? (
              <input
                className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-xl font-semibold text-zinc-950 focus:border-zinc-500 focus:outline-none"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            ) : (
              <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                {item.title}
              </h2>
            )}
          </div>
        </div>

        <dl className="mt-5 grid gap-4 text-sm">
          <div>
            <dt className="font-medium text-zinc-950">Caption</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-700">
              {isEditing ? (
                <textarea
                  className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  rows={3}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                />
              ) : (
                item.caption
              )}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-zinc-950">Description</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-700">
              {isEditing ? (
                <textarea
                  className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              ) : (
                item.description || <span className="text-zinc-400 italic">No description</span>
              )}
            </dd>
          </div>

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
              {isEditing ? (
                <input
                  className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  placeholder="e.g. #funny #video"
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                />
              ) : hashtags.length ? (
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
          {!isEditing ? (
            <>
              <div className="flex items-center gap-2 mr-2">
                <label htmlFor={`privacy-${item.job_id}`} className="text-sm font-medium text-zinc-700">Privacy:</label>
                <select
                  id={`privacy-${item.job_id}`}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                  disabled={approving || denying}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>
              <button
                className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                disabled={approving || denying}
                onClick={() => onApprove(item.job_id, privacy)}
                type="button"
              >
                {approving ? "Publishing..." : "Approve and publish"}
              </button>
              <button
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                disabled={approving || denying}
                onClick={() => onDeny(item.job_id)}
                type="button"
              >
                {denying ? "Denying..." : "Deny"}
              </button>
              <button
                className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                disabled={approving || denying}
                onClick={() => setIsEditing(true)}
                type="button"
              >
                Edit
              </button>
              <a
                className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                href={item.drive_file?.web_view_link || item.final_video_url}
                rel="noreferrer"
                target="_blank"
              >
                Open video URL
              </a>
            </>
          ) : (
            <>
              <button
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
                disabled={saving}
                onClick={handleSave}
                type="button"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving}
                onClick={handleCancel}
                type="button"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryClipCard({ item }: { item: PrePublishQueueItem }) {
  const hashtags = useMemo(
    () => item.hashtags.map(formatHashtag).filter(Boolean),
    [item.hashtags]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] items-start">
      <div className="overflow-hidden rounded bg-zinc-950">
        <iframe
          allow="autoplay; fullscreen"
          className="aspect-[9/16] max-h-[620px] w-full border-0 bg-zinc-950 object-contain"
          src={
            item.drive_file?.web_view_link
              ? item.drive_file.web_view_link.replace(/\/view.*/, "/preview")
              : item.final_video_url
          }
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
        </div>

        <dl className="mt-5 grid gap-4 text-sm opacity-90">
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
              <dt className="font-medium text-zinc-950">Updated</dt>
              <dd className="mt-1 text-zinc-700">
                {formatDate(item.updated_at)}
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
          
          {item.error ? (
            <div>
              <dt className="font-medium text-rose-700">Error Message</dt>
              <dd className="mt-1 text-rose-600 font-mono text-xs p-2 bg-rose-50 border border-rose-100 rounded">
                {item.error}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <a
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            href={item.drive_file?.web_view_link || item.final_video_url}
            rel="noreferrer"
            target="_blank"
          >
            Open Drive Video
          </a>
          {item.publish_result && Array.isArray((item.publish_result as any).results) ? (
            (item.publish_result as any).results.map((res: any, idx: number) => 
              res.youtube_url ? (
                <a
                  key={idx}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 flex items-center gap-2"
                  href={res.youtube_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <PlatformMark platform="youtube_shorts" /> View on YouTube
                </a>
              ) : null
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PendingTable({
  items,
  approvingJobId,
  denyingJobId,
  onApprove,
  onDeny,
  onUpdate,
}: {
  items: PrePublishQueueItem[];
  approvingJobId: string | null;
  denyingJobId: string | null;
  onApprove: (jobId: string, privacy: string) => void;
  onDeny: (jobId: string) => void;
  onUpdate: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm text-zinc-600">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 whitespace-nowrap">
          <tr>
            <th className="px-4 py-3 font-medium">Job ID</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Platforms</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {items.map((item) => (
            <Fragment key={item.job_id}>
              <tr className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 font-medium text-zinc-950 uppercase whitespace-nowrap">{item.job_id}</td>
                <td className="px-4 py-3 w-full max-w-[200px] sm:max-w-[300px] truncate" title={item.title}>{item.title}</td>
                <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.created_at)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-1">
                    {item.platforms.map((p) => (
                      <PlatformMark key={p.platform} platform={p.platform} small />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setExpandedId(expandedId === item.job_id ? null : item.job_id)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {expandedId === item.job_id ? "Close" : "Review"}
                  </button>
                </td>
              </tr>
              {expandedId === item.job_id && (
                <tr>
                  <td colSpan={6} className="bg-zinc-50/50 p-4 sm:p-6 border-t border-zinc-100">
                    <PendingClipCard
                      item={item}
                      approving={approvingJobId === item.job_id}
                      denying={denyingJobId === item.job_id}
                      onApprove={onApprove}
                      onDeny={onDeny}
                      onUpdate={onUpdate}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({ items }: { items: PrePublishQueueItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm text-zinc-600">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 whitespace-nowrap">
          <tr>
            <th className="px-4 py-3 font-medium">Job ID</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3 font-medium">Platforms</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {items.map((item) => (
            <Fragment key={item.job_id}>
              <tr className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 font-medium text-zinc-950 uppercase whitespace-nowrap">{item.job_id}</td>
                <td className="px-4 py-3 w-full max-w-[200px] sm:max-w-[300px] truncate" title={item.title}>{item.title}</td>
                <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.updated_at)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-1">
                    {item.platforms.map((p) => (
                      <PlatformMark key={p.platform} platform={p.platform} small />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setExpandedId(expandedId === item.job_id ? null : item.job_id)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {expandedId === item.job_id ? "Close" : "Details"}
                  </button>
                </td>
              </tr>
              {expandedId === item.job_id && (
                <tr>
                  <td colSpan={6} className="bg-zinc-50/50 p-4 sm:p-6 border-t border-zinc-100">
                    <HistoryClipCard item={item} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [items, setItems] = useState<PrePublishQueueItem[]>([]);
  const [historyItems, setHistoryItems] = useState<PrePublishQueueItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null);
  const [denyingJobId, setDenyingJobId] = useState<string | null>(null);
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

  async function loadHistory() {
    try {
      const response = await fetch("/api/pre-publish/history", {
        cache: "no-store",
      });
      const data = await response.json();
      setHistoryItems(data.items ?? []);
    } catch (loadError) {
      console.error("Failed to load history", loadError);
    }
  }

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (!active) {
        return;
      }

      await Promise.all([loadPending(), loadHistory()]);
    }

    refresh();
    const interval = window.setInterval(refresh, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function approve(jobId: string, privacy: string) {
    setApprovingJobId(jobId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/pre-publish/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId, privacy }),
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

  async function deny(jobId: string) {
    setDenyingJobId(jobId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/pre-publish/deny", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Deny failed");
      }

      setMessage(`Denied ${jobId}`);
      await loadPending();
    } catch (denyError) {
      setError(
        denyError instanceof Error
          ? denyError.message
          : "Deny failed"
      );
    } finally {
      setDenyingJobId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Publisher API</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              {activeTab === "pending" ? "Clips Waiting For Approval" : "Publish History"}
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
        ) : (
          <>
            <div className="mb-6 flex gap-6 border-b border-zinc-200">
              <button
                className={`border-b-2 py-2 text-sm font-medium transition-colors ${
                  activeTab === "pending"
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
                onClick={() => setActiveTab("pending")}
              >
                Pending Approval ({items.length})
              </button>
              <button
                className={`border-b-2 py-2 text-sm font-medium transition-colors ${
                  activeTab === "history"
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
                onClick={() => setActiveTab("history")}
              >
                Publish History ({historyItems.length})
              </button>
            </div>

            {activeTab === "pending" ? (
              items.length === 0 ? (
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
                <PendingTable
                  items={items}
                  approvingJobId={approvingJobId}
                  denyingJobId={denyingJobId}
                  onApprove={approve}
                  onDeny={deny}
                  onUpdate={loadPending}
                />
              )
            ) : (
              historyItems.length === 0 ? (
                <section className="rounded-lg border border-zinc-200 bg-white px-4 py-12 text-center">
                  <h2 className="text-lg font-semibold text-zinc-950">
                    No history items yet
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Approved or failed clips will appear here.
                  </p>
                </section>
              ) : (
                <HistoryTable items={historyItems} />
              )
            )}
          </>
        )}
      </div>
    </main>
  );
}
