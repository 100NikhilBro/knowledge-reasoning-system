import type { ReasoningContext } from "../types/reasoning-context.js";

/**
 * Explicit insufficiency clause — only discourse / non-factual wording.
 * Used when evidence supports part of a query and the rest must not be invented.
 */
export const INSUFFICIENT_EVIDENCE_CLAUSE =
  "The available evidence does not support additional claims beyond these grounded facts.";

function groundedFactLines(
  context: ReasoningContext
): string {

  return context.items
    .map(
      item =>
        `${item.entityType}: ${item.label}`
    )
    .join("\n");

}

/**
 * Deterministic grounded answer for partial-evidence cases:
 * list only attested Type: Label facts, then state insufficiency.
 *
 * Never invents domain facts. Safe for the grounding verifier.
 */
export function buildPartialGroundedAnswer(
  context: ReasoningContext
): string {

  if (context.comparison !== undefined) {
    return context.comparison;
  }

  if (context.evidence.length === 0) {
    return "";
  }

  const facts =
    groundedFactLines(context).trim();

  if (facts.length === 0) {
    return "";
  }

  return `${facts}\n\n${INSUFFICIENT_EVIDENCE_CLAUSE}`;

}
