import type { ReasoningContext } from "../types/reasoning-context.js";

/**
 * Build a searchable grounded corpus from ReasoningContext only.
 * Used to attest concrete claims in generated answers.
 */
export function buildGroundedCorpus(
  context: ReasoningContext
): string {

  const parts: string[] = [];

  if (context.comparison) {
    parts.push(context.comparison);
  }

  for (const item of context.items) {

    parts.push(
      item.entityId,
      item.entityType,
      item.label,
      item.source,
      item.evidenceSource
    );

    if (item.properties) {
      parts.push(serializeProperties(item.properties));
    }

    if (item.relationship) {
      parts.push(
        item.relationship.type,
        item.relationship.from,
        item.relationship.to
      );

      if (item.relationship.properties) {
        parts.push(
          serializeProperties(item.relationship.properties)
        );
      }
    }

  }

  for (const evidence of context.evidence) {

    parts.push(
      evidence.entity.id,
      evidence.entity.type,
      evidence.entity.label,
      evidence.entity.source,
      evidence.source
    );

    parts.push(
      serializeProperties(evidence.entity.properties ?? {})
    );

    if (evidence.relationship) {
      parts.push(
        evidence.relationship.type,
        evidence.relationship.from,
        evidence.relationship.to
      );

      if (evidence.relationship.properties) {
        parts.push(
          serializeProperties(evidence.relationship.properties)
        );
      }
    }

  }

  return parts.join("\n").toLowerCase();

}

function serializeProperties(
  properties: Record<string, unknown>
): string {

  const chunks: string[] = [];

  for (const [key, value] of Object.entries(properties)) {

    chunks.push(key);

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      chunks.push(String(value));
      chunks.push(`${key}: ${String(value)}`);
      chunks.push(`${key}=${String(value)}`);
    } else if (value !== null && value !== undefined) {
      chunks.push(JSON.stringify(value));
    }

  }

  return chunks.join("\n");

}

/**
 * Whether a concrete claim fragment is attested by the grounded corpus.
 */
export function corpusAttests(
  corpus: string,
  claim: string
): boolean {

  const normalized =
    claim.trim().toLowerCase();

  if (normalized.length === 0) {
    return true;
  }

  return corpus.includes(normalized);

}
