import type {
  ReasoningContextConfig
} from "../types/reasoning-context-config.js";

import {
  DEFAULT_REASONING_CONTEXT_MAX_EVIDENCE
} from "../types/reasoning-context-config.js";

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  field: string
): number {

  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${field} must be a positive integer`
    );
  }

  return parsed;

}

/**
 * Resolve reasoning context budget from environment.
 *
 * REASONING_CONTEXT_MAX_EVIDENCE=20
 */
export function resolveReasoningContextConfig(
  env: NodeJS.ProcessEnv = process.env
): ReasoningContextConfig {

  return {

    maxEvidence: parsePositiveInt(
      env.REASONING_CONTEXT_MAX_EVIDENCE,
      DEFAULT_REASONING_CONTEXT_MAX_EVIDENCE,
      "REASONING_CONTEXT_MAX_EVIDENCE"
    )

  };

}
