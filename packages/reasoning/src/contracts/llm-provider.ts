/**
 * Replaceable LLM / inference backend for grounded answer generation.
 *
 * Reasoning depends on this contract only — never on Groq-specific APIs.
 */
export interface LlmProvider {

  readonly id: string;

  readonly model: string;

  generate(
    request: LlmGenerationRequest
  ): Promise<LlmStructuredGeneration>;

}

export interface LlmGenerationRequest {

  /**
   * Original user query (for instruction only — not a knowledge source).
   */
  query: string;

  /**
   * Authoritative grounded evidence projection.
   */
  groundedContextJson: string;

  systemPrompt: string;

  /**
   * Optional timeout override (ms).
   */
  timeoutMs?: number;

}

/**
 * Minimal structured generation result mapped into existing contracts.
 */
export interface LlmStructuredGeneration {

  answer: string;

  /**
   * Optional model-supplied reasoning lines (not authoritative).
   * Final explanation is rebuilt from grounded context after verification.
   */
  reasoning?: string[];

  /**
   * Optional cited entity ids suggested by the model (intersected with context).
   */
  citedEntityIds?: string[];

}
