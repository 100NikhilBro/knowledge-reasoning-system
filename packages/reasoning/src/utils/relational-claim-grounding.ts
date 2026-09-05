import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  queryRequiresRelationalEvidence
} from "./detect-focus-relationships.js";

/**
 * Whether the grounded context includes at least one real relationship.
 */
export function contextHasRelationalEvidence(
  context: ReasoningContext
): boolean {

  if (
    context.items.some(
      item => item.relationship !== undefined
    )
  ) {
    return true;
  }

  return context.evidence.some(
    item => item.relationship !== undefined
  );

}

const CAUSAL_CLAIM_PATTERN =
  /\b(because|therefore|thus|hence|due to|in order to|so that|to (?:address|improve|fix|solve|enable|allow))\b/i;

/**
 * Causal HOW/WHY language in an answer requires relationship-backed context.
 * Prevents plausible but unsupported causal narration from label-only evidence.
 */
export function causalClaimsAreGrounded(
  answer: string,
  context: ReasoningContext
): boolean {

  if (!CAUSAL_CLAIM_PATTERN.test(answer)) {
    return true;
  }

  return contextHasRelationalEvidence(context);

}

/**
 * Queries that need relational evidence must not be answered from
 * disconnected entity labels alone.
 */
export function relationalQueryIsSupported(
  query: string | undefined,
  context: ReasoningContext
): boolean {

  if (!query || !queryRequiresRelationalEvidence(query)) {
    return true;
  }

  return contextHasRelationalEvidence(context);

}
