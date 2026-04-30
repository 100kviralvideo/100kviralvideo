import path from "path";

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

function optionalBoolean(name: string, fallback: boolean) {
  const value = optionalEnv(name);

  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
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

export function getComfySettings() {
  const workflowPath = optionalEnv("WORKFLOW_PATH") || "workflows/workflow_api.json";
  const outputDir = optionalEnv("OUTPUT_DIR") || "tmp/outputs";
  const jobsDir = optionalEnv("JOBS_DIR") || "tmp/jobs";

  return {
    comfyUrl: requiredEnv("COMFY_URL").replace(/\/$/, ""),
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
    outputDir: projectPath(outputDir),
    jobsDir: projectPath(jobsDir),
    uploadToDrive: optionalBoolean("UPLOAD_TO_DRIVE", true),
    googleDriveFolderId: optionalEnv("GOOGLE_DRIVE_FOLDER_ID"),
    googleDrivePublic: optionalBoolean("GOOGLE_DRIVE_PUBLIC", true),
    pollIntervalSeconds: optionalNumber("POLL_INTERVAL_SECONDS") || 5,
    jobTimeoutSeconds: optionalNumber("JOB_TIMEOUT_SECONDS") || 7200,
  };
}
