import { readFile } from "fs/promises";

type WorkflowNode = {
  inputs?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ComfyWorkflow = Record<string, WorkflowNode>;

function cloneWorkflow(workflow: ComfyWorkflow) {
  return structuredClone(workflow);
}

function getNode(workflow: ComfyWorkflow, nodeId: string) {
  const node = workflow[String(nodeId)];

  if (!node) {
    throw new Error(`Node id ${nodeId} not found in workflow API JSON`);
  }

  node.inputs ??= {};
  return node;
}

function setImageInput(workflow: ComfyWorkflow, nodeId: string, imageName: string) {
  const node = getNode(workflow, nodeId);
  node.inputs!.image = imageName;
}

function parseTimelineData(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { segments: [] as Record<string, unknown>[] };
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as { segments?: unknown }).segments)
    ) {
      return parsed as { segments: Record<string, unknown>[] };
    }
  } catch {
    return { segments: [] as Record<string, unknown>[] };
  }

  return { segments: [] as Record<string, unknown>[] };
}

function setPromptRelayTimeline({
  workflow,
  nodeId,
  globalPrompt,
  segmentPrompts,
  segmentLengths,
  fps,
}: {
  workflow: ComfyWorkflow;
  nodeId: string;
  globalPrompt: string;
  segmentPrompts: string[];
  segmentLengths?: number[];
  fps?: number;
}) {
  const node = getNode(workflow, nodeId);
  const inputs = node.inputs!;
  const existingTimeline = parseTimelineData(inputs.timeline_data);
  const existingSegments = existingTimeline.segments;
  const resolvedLengths = segmentPrompts.map((_, index) => {
    const explicitLength = segmentLengths?.[index];
    const existingLength = existingSegments[index]?.length;

    if (typeof explicitLength === "number" && Number.isFinite(explicitLength)) {
      return explicitLength;
    }

    return typeof existingLength === "number" && Number.isFinite(existingLength)
      ? existingLength
      : 121;
  });
  const segments = segmentPrompts.map((prompt, index) => ({
    ...existingSegments[index],
    prompt,
    length: resolvedLengths[index],
    color:
      typeof existingSegments[index]?.color === "string"
        ? existingSegments[index].color
        : "#4f8edc",
  }));

  inputs.global_prompt = globalPrompt;
  inputs.timeline_data = JSON.stringify({ segments });
  inputs.local_prompts = segmentPrompts.join(" | ");
  inputs.segment_lengths = resolvedLengths.join(", ");
  inputs.max_frames = resolvedLengths.reduce((sum, value) => sum + value, 0) + 1;

  if (fps !== undefined) {
    inputs.fps = fps;
  }
}

function setOptionalValue(
  workflow: ComfyWorkflow,
  nodeId: string | undefined,
  value: unknown
) {
  if (!nodeId || value === undefined || value === null) {
    return;
  }

  const node = getNode(workflow, nodeId);
  const inputs = node.inputs!;

  if ("value" in inputs) {
    inputs.value = value;
  } else if ("text" in inputs) {
    inputs.text = String(value);
  } else if ("width" in inputs && typeof value === "number") {
    inputs.width = value;
  } else if ("height" in inputs && typeof value === "number") {
    inputs.height = value;
  } else {
    inputs.value = value;
  }
}

export async function loadWorkflowApi(path: string) {
  const workflow = JSON.parse(await readFile(path, "utf-8")) as unknown;

  if (
    typeof workflow !== "object" ||
    workflow === null ||
    Array.isArray(workflow)
  ) {
    throw new Error("Workflow API file must be a JSON object");
  }

  if ("nodes" in workflow) {
    throw new Error(
      "Workflow file looks like a ComfyUI UI workflow. Export it as API format."
    );
  }

  return workflow as ComfyWorkflow;
}

export function buildWorkflow({
  baseWorkflow,
  imageNodeIds,
  imageNames,
  promptRelayNodeId,
  globalPrompt,
  segmentPrompts,
  segmentLengthNodeIds,
  widthNodeId,
  heightNodeId,
  fpsNodeId,
  imageStrengthNodeId,
  width,
  height,
  fps,
  segmentLengths,
  imageStrength,
}: {
  baseWorkflow: ComfyWorkflow;
  imageNodeIds: string[];
  imageNames: string[];
  promptRelayNodeId: string;
  globalPrompt: string;
  segmentPrompts: string[];
  segmentLengthNodeIds?: string[];
  widthNodeId?: string;
  heightNodeId?: string;
  fpsNodeId?: string;
  imageStrengthNodeId?: string;
  width?: number;
  height?: number;
  fps?: number;
  segmentLengths?: number[];
  imageStrength?: number;
}) {
  const workflow = cloneWorkflow(baseWorkflow);

  if (imageNodeIds.length !== imageNames.length) {
    throw new Error(
      `Workflow expects ${imageNodeIds.length} images, but request provided ${imageNames.length}`
    );
  }

  imageNodeIds.forEach((nodeId, index) => {
    setImageInput(workflow, nodeId, imageNames[index]);
  });

  setPromptRelayTimeline({
    workflow,
    nodeId: promptRelayNodeId,
    globalPrompt,
    segmentPrompts,
    segmentLengths,
    fps,
  });

  setOptionalValue(workflow, widthNodeId, width);
  setOptionalValue(workflow, heightNodeId, height);
  setOptionalValue(workflow, fpsNodeId, fps);
  segmentLengthNodeIds?.forEach((nodeId, index) => {
    setOptionalValue(workflow, nodeId, segmentLengths?.[index]);
  });
  setOptionalValue(workflow, imageStrengthNodeId, imageStrength);

  return workflow;
}
