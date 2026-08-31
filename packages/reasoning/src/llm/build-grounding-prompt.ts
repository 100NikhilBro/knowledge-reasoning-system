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
  "Natural-language paraphrasing of grounded labels and relationships is allowed.",
  "If the evidence only supports part of the query: answer the supported portion using only grounded facts,",
  "then clearly state that the available evidence does not support the remaining portion.",
  "Do not invent missing facts for unsupported portions (for example importance, versions, or relationships absent from evidence).",
  "If evidence is entirely insufficient for the query, say that clearly in the answer field without inventing details.",
  "Preserve grounded entity ids, labels, and sources exactly when you reference them.",
  "Respond with a single JSON object only (no markdown fences) using this shape:",
  '{"answer":"string","citedEntityIds":["entity-id"],"reasoning":["optional note"]}',
  "citedEntityIds must be a subset of grounded evidence entityId values.",
  "reasoning lines are optional notes; provenance will be rebuilt from grounded evidence."
].join(" ");

/**
 * Serialize ReasoningContext for the model — evidence only, no secrets.
 */
export function serializeGroundedContextForLlm(
  context: ReasoningContext,
  query: string
): string {

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
      budget: {
        retainedCount: context.budget.retainedCount,
        maxEvidence: context.budget.maxEvidence
      }
    },
    null,
    2
  );

}
