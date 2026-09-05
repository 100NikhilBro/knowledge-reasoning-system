import type { ReasoningContext } from "../types/reasoning-context.js";

/**
 * System prompt enforcing grounded generation from ReasoningContext only.
 */
export const GROUNDING_SYSTEM_PROMPT = [
  "You are the answer generator for a knowledge-reasoning system.",
  "You MUST answer ONLY from the supplied grounded evidence JSON.",
  "Do NOT use outside or general knowledge.",
  "Do NOT invent entities, relationships, citations, or unsupported claims.",
  "Do NOT invent examples, type/syntax forms, APIs, attributes, or factual details absent from the evidence.",
  "Do NOT invent motivation, purpose, intent, mechanism, benefit, impact, or historical cause unless those facts are explicitly present in the evidence.",
  "Natural-language paraphrasing of grounded labels and relationships is allowed.",
  "For WHAT/identity questions: answer in concise natural prose (not key-value lists).",
  "For WHY/HOW/causal/compound questions: if evidence contains explicit relationships,",
  "state those Source–Relationship–Target facts in concise natural language.",
  "Attribute each relationship to its actual source entity — never to the target or an intermediate entity.",
  "Example: if Proposal ADDRESSES Concern, say the Proposal addressed the Concern; do not say the Feature addressed it unless that exact edge exists.",
  "Stating attested relationships is a complete grounded answer when that is all the evidence supports.",
  "Do NOT add an insufficiency disclaimer when the grounded relationships already answer the askable part of the query.",
  "Only mention insufficient evidence when the user asked for a specific claim that is absent from the evidence.",
  "If evidence is entirely insufficient for the query, say that clearly in the answer field without inventing details.",
  "Preserve grounded entity ids, labels, and sources exactly when you reference them.",
  "Respond with a single JSON object only (no markdown fences) using this shape:",
  '{"answer":"string","citedEntityIds":["entity-id"],"reasoning":["optional note"]}',
  "citedEntityIds must be a subset of grounded evidence entityId values.",
  "reasoning lines are optional notes; provenance will be rebuilt from grounded evidence."
].join(" ");

/**
 * Serialize ReasoningContext for the model — evidence only, no secrets.
 * Relationships are exposed as explicit Source / Relationship / Target rows.
 */
export function serializeGroundedContextForLlm(
  context: ReasoningContext,
  query: string
): string {

  const relationships =
    collectExplicitRelationships(context);

  return JSON.stringify(
    {
      query,
      comparison: context.comparison ?? null,
      evidence: context.items.map(item => ({
        entityId: item.entityId,
        entityType: item.entityType,
        label: item.label,
        source: item.source,
        confidence: item.confidence,
        score: item.score,
        evidenceSource: item.evidenceSource,
        ...(item.properties &&
        Object.keys(item.properties).length > 0
          ? { properties: item.properties }
          : {}),
        ...(item.relationship
          ? {
              relationship: {
                from: item.relationship.from,
                to: item.relationship.to,
                type: item.relationship.type,
                confidence: item.relationship.confidence
              }
            }
          : {})
      })),
      relationships,
      budget: {
        retainedCount: context.budget.retainedCount,
        maxEvidence: context.budget.maxEvidence
      }
    },
    null,
    2
  );

}

function collectExplicitRelationships(
  context: ReasoningContext
): Array<{
  sourceId: string;
  sourceLabel: string;
  relationship: string;
  targetId: string;
  targetLabel: string;
}> {

  const labelById =
    new Map<string, string>();

  for (const item of context.items) {
    labelById.set(item.entityId, item.label);
  }

  for (const item of context.evidence) {
    if (!labelById.has(item.entity.id)) {
      labelById.set(
        item.entity.id,
        item.entity.label
      );
    }
  }

  const seen =
    new Set<string>();

  const rows: Array<{
    sourceId: string;
    sourceLabel: string;
    relationship: string;
    targetId: string;
    targetLabel: string;
  }> = [];

  for (const item of context.items) {

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

    rows.push({
      sourceId: relationship.from,
      sourceLabel:
        labelById.get(relationship.from) ??
        relationship.from,
      relationship: relationship.type,
      targetId: relationship.to,
      targetLabel:
        labelById.get(relationship.to) ??
        relationship.to
    });

  }

  return rows;

}
