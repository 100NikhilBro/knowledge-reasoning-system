import type {
  LlmGenerationRequest,
  LlmProvider,
  LlmStructuredGeneration
} from "../contracts/llm-provider.js";

import {
  LlmError,
  redactLlmErrorText
} from "../errors/llm-error.js";

import { parseLlmStructuredOutput } from "../llm/parse-llm-structured-output.js";

export interface GroqLlmProviderOptions {

  apiKey: string;

  model: string;

  baseUrl: string;

  timeoutMs: number;

  /**
   * Injectable fetch for unit tests.
   */
  fetchImpl?: typeof fetch;

}

interface GroqChatResponse {

  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;

  error?: {
    message?: string;
    code?: string;
    type?: string;
  };

}

function extractProviderErrorDetail(
  bodyText: string
): {
  message?: string;
  code?: string;
} {

  try {
    const parsed =
      JSON.parse(bodyText) as GroqChatResponse;

    return {
      message: parsed.error?.message,
      code: parsed.error?.code
    };
  } catch {
    return {};
  }

}

/**
 * Groq chat-completions provider (OpenAI-compatible HTTP API).
 */
export class GroqLlmProvider
  implements LlmProvider {

  readonly id = "groq";

  readonly model: string;

  private readonly apiKey: string;

  private readonly baseUrl: string;

  private readonly timeoutMs: number;

  private readonly fetchImpl: typeof fetch;

  constructor(
    options: GroqLlmProviderOptions
  ) {

    if (!options.apiKey?.trim()) {
      throw new LlmError(
        "MISSING_API_KEY",
        "GROQ_API_KEY is required for the Groq provider"
      );
    }

    if (!options.model?.trim()) {
      throw new LlmError(
        "INVALID_CONFIG",
        "GROQ_MODEL is required"
      );
    }

    this.apiKey = options.apiKey.trim();
    this.model = options.model.trim();
    this.baseUrl =
      options.baseUrl.replace(/\/$/, "");
    this.timeoutMs =
      options.timeoutMs;
    this.fetchImpl =
      options.fetchImpl ?? fetch;

  }

  async generate(
    request: LlmGenerationRequest
  ): Promise<LlmStructuredGeneration> {

    const timeoutMs =
      request.timeoutMs ?? this.timeoutMs;

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        timeoutMs
      );

    let response: Response;

    try {

      response =
        await this.fetchImpl(
          `${this.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${this.apiKey}`,
              "Content-Type":
                "application/json",
              Accept:
                "application/json"
            },
            body: JSON.stringify({
              model: this.model,
              temperature: 0,
              response_format: {
                type: "json_object"
              },
              messages: [
                {
                  role: "system",
                  content: request.systemPrompt
                },
                {
                  role: "user",
                  content: [
                    "Grounded evidence (authoritative):",
                    request.groundedContextJson,
                    "",
                    "Produce the JSON answer for the query. Use only the grounded evidence."
                  ].join("\n")
                }
              ]
            }),
            signal: controller.signal
          }
        );

    } catch (error) {

      clearTimeout(timer);

      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new LlmError(
          "TIMEOUT",
          `LLM request timed out after ${timeoutMs}ms`
        );
      }

      throw new LlmError(
        "PROVIDER_FAILURE",
        redactLlmErrorText(
          error instanceof Error
            ? error.message
            : "LLM provider request failed"
        ),
        {
          cause: error
        }
      );

    } finally {

      clearTimeout(timer);

    }

    let bodyText = "";

    try {
      bodyText = await response.text();
    } catch {
      bodyText = "";
    }

    if (!response.ok) {

      const providerDetail =
        extractProviderErrorDetail(bodyText);

      const providerCode =
        (providerDetail.code ?? "").toLowerCase();

      const llmCode =
        response.status === 429 ||
        providerCode.includes("rate_limit")
          ? "RATE_LIMITED"
          : providerCode === "model_not_found"
            ? "INVALID_CONFIG"
            : "PROVIDER_FAILURE";

      throw new LlmError(
        llmCode,
        redactLlmErrorText(
          providerDetail.message
            ? `LLM provider HTTP ${response.status}: ${providerDetail.message}`
            : `LLM provider HTTP ${response.status}`
        )
      );

    }

    let payload: GroqChatResponse;

    try {
      payload =
        JSON.parse(bodyText) as GroqChatResponse;
    } catch {
      throw new LlmError(
        "MALFORMED_OUTPUT",
        "LLM provider returned non-JSON HTTP body"
      );
    }

    if (payload.error?.message) {
      throw new LlmError(
        "PROVIDER_FAILURE",
        redactLlmErrorText(
          `LLM provider error: ${payload.error.message}`
        )
      );
    }

    const content =
      payload.choices?.[0]?.message?.content;

    if (
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      throw new LlmError(
        "MALFORMED_OUTPUT",
        "LLM provider returned empty message content"
      );
    }

    return parseLlmStructuredOutput(content);

  }

}
