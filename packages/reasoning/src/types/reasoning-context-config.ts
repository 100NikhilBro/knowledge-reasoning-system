export interface ReasoningContextConfig {

  /**
   * Maximum grounded evidence items retained for answer generation.
   */
  maxEvidence: number;

}

export const DEFAULT_REASONING_CONTEXT_MAX_EVIDENCE =
  20;
