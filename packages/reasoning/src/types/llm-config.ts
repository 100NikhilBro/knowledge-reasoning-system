export type LlmProviderKind =
  | "groq"
  | "template";

export interface LlmConfig {

  provider: LlmProviderKind;

  /**
   * Provider API key (never logged).
   */
  apiKey: string;

  model: string;

  /**
   * OpenAI-compatible API base URL.
   */
  baseUrl: string;

  timeoutMs: number;

}
