import path from "path";
import os from "os";

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function requiredEnv(name: string) {
  const value = optionalEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalNumber(name: string) {
  const value = optionalEnv(name);
  return value === undefined ? undefined : Number(value);
}

function csvEnv(name: string, fallback: string[]) {
  const value = optionalEnv(name);

  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function projectPath(value: string) {
  if (path.isAbsolute(value)) {
    return value;
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), value);
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function isWithinPath(target: string, parent: string) {
  const relativePath = path.relative(parent, target);
  return (
    relativePath === "" ||
    (Boolean(relativePath) &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath))
  );
}

function writablePath(value: string) {
  const tmpDir = os.tmpdir();

  if (path.isAbsolute(value)) {
    if (!isVercelRuntime() || isWithinPath(value, tmpDir)) {
      return value;
    }

    const relativeToProject = path.relative(
      /* turbopackIgnore: true */ process.cwd(),
      value
    );

    if (relativeToProject && !relativeToProject.startsWith("..")) {
      return path.join(tmpDir, relativeToProject);
    }

    return path.join(tmpDir, path.basename(value));
  }

  if (isVercelRuntime()) {
    return path.join(tmpDir, value);
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), value);
}

export function getComfySettings() {
  const workflowPath = optionalEnv("WORKFLOW_PATH") || "workflows/workflow_api.json";
  const jobsDir = optionalEnv("JOBS_DIR") || "tmp/jobs";
  const comfyUrl = requiredEnv("COMFY_URL");

  return {
    comfyUrl: comfyUrl.replace(/\/$/, ""),
    workflowPath: projectPath(workflowPath),
    imageNodeIds: csvEnv("IMAGE_NODE_IDS", ["820", "1072", "1082", "1092"]),
    promptRelayNodeId: optionalEnv("PROMPT_RELAY_NODE_ID") || "948",
    widthNodeId: optionalEnv("WIDTH_NODE_ID"),
    heightNodeId: optionalEnv("HEIGHT_NODE_ID"),
    fpsNodeId: optionalEnv("FPS_NODE_ID"),
    segmentLengthNodeIds: csvEnv("SEGMENT_LENGTH_NODE_IDS", [
      "950",
      "1074",
      "1084",
      "1094",
    ]),
    imageStrengthNodeId: optionalEnv("IMAGE_STRENGTH_NODE_ID"),
    outputNodeId: optionalEnv("COMFY_OUTPUT_NODE_ID"),
    jobsDir: writablePath(jobsDir),
    pollIntervalSeconds: optionalNumber("POLL_INTERVAL_SECONDS") || 5,
    jobTimeoutSeconds: optionalNumber("JOB_TIMEOUT_SECONDS") || 7200,
  };
}

export function getComfyStorageSettings() {
  const jobsDir = optionalEnv("JOBS_DIR") || "tmp/jobs";

  return {
    jobsDir: writablePath(jobsDir),
  };
}
