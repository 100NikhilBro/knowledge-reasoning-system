export type EmbeddingProviderKind =
  | "deterministic"
  | "openai-compatible";

export interface EmbeddingConfig {

  provider: EmbeddingProviderKind;

  model: string;

  dimensions: number;

  /**
   * Required when provider is "openai-compatible".
   */
  apiKey?: string;

  /**
   * OpenAI-compatible API base URL.
   * Defaults to https://api.openai.com/v1
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds for remote providers.
   */
  timeoutMs?: number;

  /**
   * Maximum texts accepted in a single embedDocuments call.
   */
  maxBatchSize?: number;

}
