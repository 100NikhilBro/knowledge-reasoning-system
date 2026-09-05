import type {
  Evidence,
  ProvenanceChannel,
  ReasoningResult,
  ResultGroundingState
} from "../types/reasoning";

/**
 * Derive provenance channel from public evidence fields only.
 * Prefers metadata.sources when present; otherwise uses evidence.source.
 */
export function resolveProvenanceChannel(
  item: Pick<Evidence, "source" | "metadata">
): ProvenanceChannel {
  const fromMeta = normalizeSources(item.metadata?.sources);

  if (fromMeta.includes("graph") && fromMeta.includes("vector")) {
    return "hybrid";
  }

  if (fromMeta.includes("graph")) {
    return "graph";
  }

  if (fromMeta.includes("vector")) {
    return "vector";
  }

  const channel = String(item.source ?? "")
    .trim()
    .toLowerCase();

  if (channel === "graph") {
    return "graph";
  }

  if (channel === "vector") {
    return "vector";
  }

  if (channel.includes("graph") && channel.includes("vector")) {
    return "hybrid";
  }

  return "unknown";
}

export function provenanceLabel(
  channel: ProvenanceChannel
): string {
  switch (channel) {
    case "graph":
      return "Graph";
    case "vector":
      return "Vector";
    case "hybrid":
      return "Graph + Vector";
    default:
      return "Source";
  }
}

function normalizeSources(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Public result grounding classification from answer + confidence.
 * No new API field required:
 * - empty + conf 0 → fail_closed (no information)
 * - non-empty + conf 0 → bounded (entities found, relationship not established)
 * - answer bounds missing claims → partial
 * - otherwise grounded
 */
export function classifyGroundingState(
  result: ReasoningResult
): ResultGroundingState {
  const answer = result.answer.trim();

  if (answer.length === 0) {
    return result.confidence === 0 ? "fail_closed" : "empty";
  }

  if (result.confidence === 0) {
    return "bounded";
  }

  if (
    /does not establish/i.test(answer) ||
    /requested relationship/i.test(answer)
  ) {
    return "partial";
  }

  return "grounded";
}

/**
 * Verification is inferred from a non-empty grounded answer with
 * confidence in [0, 1]. The public API does not expose a separate
 * verification flag — this mirrors fail-closed semantics.
 */
export function isVerifiedAppearance(
  result: ReasoningResult
): boolean {
  return (
    classifyGroundingState(result) === "grounded" &&
    result.confidence > 0 &&
    result.confidence <= 1
  );
}

export function clampConfidenceDisplay(
  confidence: number
): number {
  if (!Number.isFinite(confidence)) {
    return 0;
  }

  return Math.min(1, Math.max(0, confidence));
}

export function formatConfidencePercent(
  confidence: number
): string {
  const clamped = clampConfidenceDisplay(confidence);
  return `${Math.round(clamped * 100)}%`;
}
