import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import type { EmbeddingVector } from "../types/embedding-vector.js";

import { EmbeddingError } from "../errors/embedding-error.js";

import { sanitizeProviderText }
from "../utils/sanitize-provider-text.js";

import {
  assertNonEmptyText,
  assertNonEmptyTexts,
  assertVectorDimensions
} from "../utils/validate-embedding-input.js";

export interface OpenAICompatibleEmbeddingProviderOptions {

  model: string;

  dimensions: number;

  apiKey: string;

  baseUrl?: string;

  timeoutMs?: number;

  maxBatchSize?: number;

  /**
   * Injectable fetch for tests.
   */
  fetchImpl?: typeof fetch;

}

interface OpenAIEmbeddingResponse {

  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;

  model?: string;

  error?: {
    message?: string;
  };

}

/**
 * OpenAI-compatible HTTP embedding provider.
 *
 * Talks to POST {baseUrl}/embeddings with a Bearer token.
 */
export class OpenAICompatibleEmbeddingProvider
  implements EmbeddingProvider {

  readonly id = "openai-compatible";

  readonly model: string;

  readonly dimensions: number;

  private readonly apiKey: string;

  private readonly baseUrl: string;

  private readonly timeoutMs: number;

  private readonly maxBatchSize: number;

  private readonly fetchImpl: typeof fetch;

  constructor(
    options: OpenAICompatibleEmbeddingProviderOptions
  ) {

    if (!options.apiKey?.trim()) {
      throw new EmbeddingError(
        "MISSING_API_KEY",
        "apiKey is required for openai-compatible provider"
      );
    }

    if (
      !Number.isInteger(options.dimensions) ||
      options.dimensions < 2
    ) {
      throw new EmbeddingError(
        "INVALID_CONFIG",
        "dimensions must be an integer >= 2"
      );
    }

    if (!options.model?.trim()) {
      throw new EmbeddingError(
        "INVALID_CONFIG",
        "model is required"
      );
    }

    this.model = options.model.trim();
    this.dimensions = options.dimensions;
    this.apiKey = options.apiKey.trim();

    this.baseUrl =
      (options.baseUrl ?? "https://api.openai.com/v1")
        .replace(/\/$/, "");

    this.timeoutMs =
      options.timeoutMs ?? 30_000;

    this.maxBatchSize =
      options.maxBatchSize ?? 64;

    this.fetchImpl =
      options.fetchImpl ?? fetch;

  }

  async embedDocuments(
    texts: string[]
  ): Promise<EmbeddingVector[]> {

    const normalized =
      assertNonEmptyTexts(
        texts,
        this.maxBatchSize
      );

    return this.requestEmbeddings(normalized);

  }

  async embedQuery(
    text: string
  ): Promise<EmbeddingVector> {

    const normalized =
      assertNonEmptyText(text);

    const [vector] =
      await this.requestEmbeddings([normalized]);

    return vector;

  }

  private async requestEmbeddings(
    texts: string[]
  ): Promise<EmbeddingVector[]> {

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        this.timeoutMs
      );

    try {

      const response =
        await this.fetchImpl(
          `${this.baseUrl}/embeddings`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              model: this.model,
              input: texts.length === 1 ? texts[0] : texts,
              dimensions: this.dimensions
            }),
            signal: controller.signal
          }
        );

      const payload =
        await this.parseResponse(response);

      if (!response.ok) {
        throw new EmbeddingError(
          "PROVIDER_HTTP_ERROR",
          this.sanitize(
            payload.error?.message
              ?? `Embedding provider returned HTTP ${response.status}`
          )
        );
      }

      if (!payload.data || payload.data.length === 0) {
        throw new EmbeddingError(
          "PROVIDER_EMPTY_RESPONSE",
          "Embedding provider returned no vectors"
        );
      }

      const ordered =
        [...payload.data].sort(
          (left, right) =>
            (left.index ?? 0) - (right.index ?? 0)
        );

      if (ordered.length !== texts.length) {
        throw new EmbeddingError(
          "PROVIDER_COUNT_MISMATCH",
          `Expected ${texts.length} vectors, received ${ordered.length}`
        );
      }

      const vectors =
        ordered.map(item => {

          if (!item.embedding) {
            throw new EmbeddingError(
              "PROVIDER_EMPTY_RESPONSE",
              "Embedding provider returned an item without embedding"
            );
          }

          return item.embedding;

        });

      assertVectorDimensions(
        vectors,
        this.dimensions
      );

      return vectors;

    } catch (error) {

      if (error instanceof EmbeddingError) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new EmbeddingError(
          "PROVIDER_TIMEOUT",
          `Embedding request timed out after ${this.timeoutMs}ms`,
          { cause: error }
        );
      }

      throw new EmbeddingError(
        "PROVIDER_REQUEST_FAILED",
        this.sanitize(
          error instanceof Error
            ? error.message
            : "Embedding request failed"
        ),
        { cause: error instanceof Error ? error : undefined }
      );

    } finally {

      clearTimeout(timeout);

    }

  }

  private sanitize(message: string): string {

    return sanitizeProviderText(message, [this.apiKey]);

  }

  private async parseResponse(
    response: Response
  ): Promise<OpenAIEmbeddingResponse> {

    try {

      return await response.json() as OpenAIEmbeddingResponse;

    } catch (error) {

      throw new EmbeddingError(
        "PROVIDER_INVALID_JSON",
        "Embedding provider returned invalid JSON",
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

}
