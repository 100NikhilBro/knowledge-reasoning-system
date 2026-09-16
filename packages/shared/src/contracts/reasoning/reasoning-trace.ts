import type { ReasoningStep }
from "./reasoning-step.js";

/**
 * Optional structured summary for reconstructible audit (P5).
 * Steps remain the primary human-readable trail.
 */
export interface ReasoningTraceMeta {

  intent?: string;

  pathInterpretation?: {
    kind: string;
    sourceEntity?: string;
    targetEntity?: string;
    bridgeEntities?: string[];
    relationships?: string[];
    hopCount?: number;
    supportsClaim?: boolean;
    explanation?: string;
  };

  verificationStatus?: string;

  claimSupport?: {
    supported?: string[];
    unsupported?: string[];
    missing?: string[];
  };

  confidence?: {
    score: number;
    level: string;
    reasons: string[];
  };

  analytical?: {
    operation?: string;
    status?: string;
    value?: number | boolean;
    subject?: string;
    scope?: string;
    deduplicatedEntityIds?: string[];
    matchedEntityIds?: string[];
    filters?: Record<string, string | undefined>;
    explanation?: string;
  };

  summarization?: {
    mode?: string;
    requestedMode?: string;
    status?: string;
    scope?: string;
    documentCount?: number;
    documents?: string[];
    sharedEntityIds?: string[];
    supportedClaimCount?: number;
    unsupportedGaps?: string[];
    explanation?: string;
  };

  /**
   * Diagnostic-only: preserves the pre-attribution answer when verification
   * may replace it with a grounded fallback. Does not affect status semantics.
   */
  attributionDiagnostics?: {
    originalAnswerBeforeVerification: string;
    attributionResult: boolean;
    finalAnswerAfterVerification: string;
    finalVerificationStatus: string;
  };

}

export interface ReasoningTrace {

  steps: ReasoningStep[];

  /**
   * Compact machine-readable summary; optional for backward compatibility.
   */
  meta?: ReasoningTraceMeta;

}
