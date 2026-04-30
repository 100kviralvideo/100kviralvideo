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

type ApprovalForm = {
  folderId: string;
  videoFilename: string;
  jobId: string;
  title: string;
  caption: string;
  description: string;
  hashtags: string;
  durationSec: string;
  humanApproved: boolean;
  rightsCleared: boolean;
  selectedPlatforms: Record<PlatformName, boolean>;
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

const defaultApprovalForm: ApprovalForm = {
  folderId: "",
  videoFilename: "",
  jobId: "",
  title: "",
  caption: "",
  description: "AI-generated movie commentary.",
  hashtags: "movies, film, shorts",
  durationSec: "60",
  humanApproved: false,
  rightsCleared: false,
  selectedPlatforms: {
    youtube_shorts: true,
    instagram_reels: false,
    tiktok: false,
  },
};

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

function inputClassName(extra = "") {
  return `w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 ${extra}`;
}

function parseHashtags(value: string) {
  return value
    .split(",")
    .map((hashtag) => hashtag.trim().replace(/^#/, ""))
    .filter(Boolean);
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
  const [publisherApiKey, setPublisherApiKey] = useState("");
  const [approvalForm, setApprovalForm] =
    useState<ApprovalForm>(defaultApprovalForm);
  const [driveVideo, setDriveVideo] = useState<DriveVideoResult | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [findingVideo, setFindingVideo] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [historyResponse, configResponse] = await Promise.all([
          fetch("/api/history", { cache: "no-store" }),
          fetch("/api/config-check", { cache: "no-store" }),
        ]);
        const historyData = (await historyResponse.json()) as {
          source?: string;
          history?: PublishHistoryItem[];
        };
        const configData = (await configResponse.json()) as ConfigStatus;

        if (active) {
          setHistory(historyData.history ?? []);
          setHistorySource(historyData.source ?? "memory");
          setConfig(configData);
        }
      } finally {
        if (active) {
          setLoading(false);
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

  function updateApprovalForm<TField extends keyof ApprovalForm>(
    field: TField,
    value: ApprovalForm[TField]
  ) {
    setApprovalForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePlatform(platform: PlatformName, checked: boolean) {
    setApprovalForm((current) => ({
      ...current,
      selectedPlatforms: {
        ...current.selectedPlatforms,
        [platform]: checked,
      },
    }));
  }

  function rememberPublisherKey(value: string) {
    setPublisherApiKey(value);
  }

  async function refreshHistory() {
    const historyResponse = await fetch("/api/history", { cache: "no-store" });
    const historyData = (await historyResponse.json()) as {
      source?: string;
      history?: PublishHistoryItem[];
    };

    setHistory(historyData.history ?? []);
    setHistorySource(historyData.source ?? "memory");
  }

  async function findDriveVideo() {
    setFindingVideo(true);
    setWorkflowError(null);
    setWorkflowMessage(null);
    setDriveVideo(null);

    try {
      const data = (await readJsonResponse(
        await fetch("/api/drive/find-video", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publisherApiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            folder_id: approvalForm.folderId,
            video_filename: approvalForm.videoFilename,
          }),
        })
      )) as DriveVideoResult;

      setDriveVideo(data);
      setWorkflowMessage("Video found. Review the details and approve publish.");

      setApprovalForm((current) => ({
        ...current,
        jobId:
          current.jobId ||
          current.videoFilename.replace(/\.[^.]+$/, "") ||
          `job_${Date.now()}`,
        title: current.title || current.videoFilename.replace(/\.[^.]+$/, ""),
      }));
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "Find video failed");
    } finally {
      setFindingVideo(false);
    }
  }

  async function publishApprovedClip() {
    const selectedPlatforms = platforms
      .filter((platform) => approvalForm.selectedPlatforms[platform.id])
      .map((platform) => {
        if (platform.id === "youtube_shorts") {
          return { platform: platform.id, privacy: "private" };
        }

        return { platform: platform.id };
      });

    if (!driveVideo) {
      setWorkflowError("Find the final video before publishing.");
      return;
    }

    if (!approvalForm.humanApproved || !approvalForm.rightsCleared) {
      setWorkflowError("Human approval and rights clearance are required.");
      return;
    }

    if (selectedPlatforms.length === 0) {
      setWorkflowError("Select at least one platform.");
      return;
    }

    setPublishing(true);
    setWorkflowError(null);
    setWorkflowMessage(null);

    try {
      const data = await readJsonResponse(
        await fetch("/api/publish", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publisherApiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_id: approvalForm.jobId,
            final_video_url: driveVideo.final_video_url,
            title: approvalForm.title,
            caption: approvalForm.caption,
            description: approvalForm.description,
            hashtags: parseHashtags(approvalForm.hashtags),
            duration_sec: Number(approvalForm.durationSec),
            human_approved: approvalForm.humanApproved,
            rights_cleared: approvalForm.rightsCleared,
            ai_generated: true,
            platforms: selectedPlatforms,
          }),
        })
      );

      setWorkflowMessage(`Publish processed for ${data.job_id}.`);
      await refreshHistory();
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setPublishing(false);
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
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-base font-semibold">Review and Publish</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Find the generated Drive file, review the publishing metadata, then
              approve it before calling the Publisher API.
            </p>
          </div>

          <div className="grid gap-5 p-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Publisher API key
                </span>
                <input
                  className={inputClassName("mt-1")}
                  onChange={(event) => rememberPublisherKey(event.target.value)}
                  placeholder="test_secret_key"
                  type="password"
                  value={publisherApiKey}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    Drive folder ID
                  </span>
                  <input
                    className={inputClassName("mt-1")}
                    onChange={(event) =>
                      updateApprovalForm("folderId", event.target.value)
                    }
                    placeholder="Google Drive folder ID"
                    value={approvalForm.folderId}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    Video filename
                  </span>
                  <input
                    className={inputClassName("mt-1")}
                    onChange={(event) =>
                      updateApprovalForm("videoFilename", event.target.value)
                    }
                    placeholder="clip_xxx_final.mp4"
                    value={approvalForm.videoFilename}
                  />
                </label>
              </div>

              <button
                className="rounded border border-zinc-900 bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                disabled={
                  findingVideo ||
                  !publisherApiKey.trim() ||
                  !approvalForm.folderId.trim() ||
                  !approvalForm.videoFilename.trim()
                }
                onClick={findDriveVideo}
                type="button"
              >
                {findingVideo ? "Finding video" : "Find video"}
              </button>

              {driveVideo ? (
                <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="font-medium">{driveVideo.name}</p>
                  <p className="mt-1 break-all">{driveVideo.final_video_url}</p>
                  {driveVideo.warning ? (
                    <p className="mt-2 text-amber-800">{driveVideo.warning}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Job ID</span>
                  <input
                    className={inputClassName("mt-1")}
                    onChange={(event) =>
                      updateApprovalForm("jobId", event.target.value)
                    }
                    placeholder="youtube_test_001"
                    value={approvalForm.jobId}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    Duration seconds
                  </span>
                  <input
                    className={inputClassName("mt-1")}
                    min="1"
                    onChange={(event) =>
                      updateApprovalForm("durationSec", event.target.value)
                    }
                    type="number"
                    value={approvalForm.durationSec}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-zinc-700">Title</span>
                <input
                  className={inputClassName("mt-1")}
                  onChange={(event) =>
                    updateApprovalForm("title", event.target.value)
                  }
                  placeholder="Why This Movie Ending Works"
                  value={approvalForm.title}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-700">Caption</span>
                <textarea
                  className={inputClassName("mt-1 min-h-20")}
                  onChange={(event) =>
                    updateApprovalForm("caption", event.target.value)
                  }
                  placeholder="This ending looks confusing, but it actually has one clear purpose."
                  value={approvalForm.caption}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Description
                </span>
                <input
                  className={inputClassName("mt-1")}
                  onChange={(event) =>
                    updateApprovalForm("description", event.target.value)
                  }
                  value={approvalForm.description}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Hashtags
                </span>
                <input
                  className={inputClassName("mt-1")}
                  onChange={(event) =>
                    updateApprovalForm("hashtags", event.target.value)
                  }
                  placeholder="movies, film, shorts"
                  value={approvalForm.hashtags}
                />
              </label>
            </div>
          </div>

          <div className="border-t border-zinc-200 p-4">
            <div className="flex flex-wrap gap-3">
              {platforms.map((platform) => (
                <label
                  className="flex min-h-12 items-center gap-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800"
                  key={platform.id}
                >
                  <input
                    checked={approvalForm.selectedPlatforms[platform.id]}
                    className="h-4 w-4"
                    onChange={(event) =>
                      updatePlatform(platform.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <PlatformMark platform={platform.id} />
                  {platform.label}
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
                <input
                  checked={approvalForm.humanApproved}
                  className="mt-0.5 h-4 w-4"
                  onChange={(event) =>
                    updateApprovalForm("humanApproved", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Human reviewed and approved this clip for publishing.</span>
              </label>
              <label className="flex items-start gap-3 rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
                <input
                  checked={approvalForm.rightsCleared}
                  className="mt-0.5 h-4 w-4"
                  onChange={(event) =>
                    updateApprovalForm("rightsCleared", event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Rights are cleared for the selected platforms.</span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="rounded border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
                disabled={
                  publishing ||
                  !driveVideo ||
                  !approvalForm.humanApproved ||
                  !approvalForm.rightsCleared ||
                  !approvalForm.jobId.trim() ||
                  !approvalForm.title.trim() ||
                  !approvalForm.caption.trim()
                }
                onClick={publishApprovedClip}
                type="button"
              >
                {publishing ? "Publishing" : "Approve and publish"}
              </button>

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
          </div>
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
