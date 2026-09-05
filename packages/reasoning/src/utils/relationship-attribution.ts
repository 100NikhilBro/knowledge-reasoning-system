import type {
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

/**
 * Natural-language verbs tied to attested relationship types.
 * Used only to verify that answer attribution matches edge direction.
 */
const ATTRIBUTION_CHECKS: Array<{
  type: string;
  pattern: RegExp;
}> = [
  {
    type: "ADDRESSES",
    pattern:
      /\b([A-Za-z][\w\s-]{0,60}?)\s+address(?:es|ed)\s+([A-Za-z][\w\s-]{0,60}?)(?:\.|,|;|$)/gi
  },
  {
    type: "INTRODUCES",
    pattern:
      /\b([A-Za-z][\w\s-]{0,60}?)\s+introduced?\s+([A-Za-z][\w\s-]{0,60}?)(?:\.|,|;|$)/gi
  },
  {
    type: "PROPOSED_BY",
    pattern:
      /\b([A-Za-z][\w\s-]{0,60}?)\s+was proposed by\s+([A-Za-z][\w\s-]{0,60}?)(?:\.|,|;|$)/gi
  },
  {
    type: "RESULTS_IN",
    pattern:
      /\b([A-Za-z][\w\s-]{0,60}?)\s+resulted in\s+([A-Za-z][\w\s-]{0,60}?)(?:\.|,|;|$)/gi
  },
  {
    type: "IMPLEMENTED_IN",
    pattern:
      /\b([A-Za-z][\w\s-]{0,60}?)\s+was implemented in\s+([A-Za-z][\w\s-]{0,60}?)(?:\.|,|;|$)/gi
  }
];

/**
 * Reject answers that linguistically attribute a relationship to the
 * wrong endpoint (e.g. "Typing addressed Readability" when the edge is
 * Proposal --ADDRESSES--> Readability).
 */
export function relationshipAttributionIsGrounded(
  answer: string,
  context: ReasoningContext
): boolean {

  const relationships =
    collectRelationships(context);

  if (relationships.length === 0) {
    return true;
  }

  const labelById =
    buildLabelById(context);

  for (const check of ATTRIBUTION_CHECKS) {
    check.pattern.lastIndex = 0;

    for (const match of answer.matchAll(check.pattern)) {
      const sourcePhrase =
        (match[1] ?? "").trim();

      const targetPhrase =
        (match[2] ?? "").trim();

      if (!sourcePhrase || !targetPhrase) {
        continue;
      }

      const grounded =
        relationships.some(relationship => {
          if (relationship.type !== check.type) {
            return false;
          }

          const fromLabel =
            labelById.get(relationship.from) ??
            relationship.from;

          const toLabel =
            labelById.get(relationship.to) ??
            relationship.to;

          return (
            phraseRefersTo(sourcePhrase, fromLabel, relationship.from) &&
            phraseRefersTo(targetPhrase, toLabel, relationship.to)
          );
        });

      if (!grounded) {
        return false;
      }
    }
  }

  return true;

}

function collectRelationships(
  context: ReasoningContext
): KnowledgeRelationship[] {

  const seen =
    new Set<string>();

  const rows: KnowledgeRelationship[] = [];

  for (const item of [
    ...context.items,
    ...context.evidence.map(entry => ({
      relationship: entry.relationship
    }))
  ]) {

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    const key =
      `${relationship.from}|${relationship.type}|${relationship.to}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push(relationship);

  }

  return rows;

}

function buildLabelById(
  context: ReasoningContext
): Map<string, string> {

  const labels =
    new Map<string, string>();

  for (const item of context.items) {
    labels.set(item.entityId, item.label);
  }

  for (const item of context.evidence) {
    if (!labels.has(item.entity.id)) {
      labels.set(item.entity.id, item.entity.label);
    }
  }

  return labels;

}

function phraseRefersTo(
  phrase: string,
  label: string,
  id: string
): boolean {

  const compactPhrase =
    compact(phrase);

  const compactLabel =
    compact(label);

  const compactId =
    compact(id);

  if (!compactPhrase) {
    return false;
  }

  if (
    compactPhrase === compactLabel ||
    compactLabel.includes(compactPhrase) ||
    compactPhrase.includes(compactLabel)
  ) {
    return true;
  }

  if (
    compactId.includes(compactPhrase) ||
    compactPhrase.includes(compactId.replace(/^[^a-z0-9]+/, ""))
  ) {
    return true;
  }

  /*
   * Allow coded topic shorthand (PEP-484) when the id encodes it.
   */
  const idTail =
    id.includes(":")
      ? compact(id.slice(id.indexOf(":") + 1))
      : compactId;

  return (
    idTail.length >= 3 &&
    (compactPhrase === idTail ||
      compactPhrase.includes(idTail) ||
      idTail.includes(compactPhrase))
  );

}

function compact(
  value: string
): string {

  return value
    .toLowerCase()
    .replace(/[^\w]/g, "");

}
