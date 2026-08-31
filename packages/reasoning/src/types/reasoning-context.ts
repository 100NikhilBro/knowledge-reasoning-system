import type {
  Evidence,
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  ReasoningContextConfig
} from "./reasoning-context-config.js";

/**
 * Explicit projection of verified evidence used for grounded answer generation.
 * Internal to the reasoning package — not part of the public API contract.
 */
export interface GroundedEvidenceItem {

  entityId: string;

  entityType: string;

  label: string;

  source: string;

  confidence: number;

  score: number;

  /**
   * Provenance channel from Evidence.source (e.g. graph, vector).
   */
  evidenceSource: string;

  /**
   * Grounded entity properties from verified evidence (optional).
   */
  properties?: Record<string, unknown>;

  /**
   * Included only when the reasoning pipeline already produced a relationship.
   */
  relationship?: KnowledgeRelationship;

}

export interface ReasoningContextBudget {

  maxEvidence: number;

  inputCount: number;

  retainedCount: number;

  truncated: boolean;

}

export interface ReasoningContext {

  /**
   * Optional user query associated with this context (for LLM instruction).
   * Not a knowledge source — grounded items remain authoritative.
   */
  query?: string;

  /**
   * Ordered grounded items (highest-ranked first when synthesizer sorted).
   */
  items: GroundedEvidenceItem[];

  /**
   * Original verified evidence retained after budget (same order as items).
   * Used by confidence/citation/trace builders without inventing data.
   */
  evidence: Evidence[];

  /**
   * Comparison summary only when already produced by the comparison strategy.
   */
  comparison?: string;

  budget: ReasoningContextBudget;

  config: ReasoningContextConfig;

}
