import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import type { EmbeddingResult } from "../types/embedding-result.js";
import type { EmbeddingVector } from "../types/embedding-vector.js";

import { EmbeddingError } from "../errors/embedding-error.js";

import { DeterministicEmbeddingProvider }
from "../providers/deterministic.embedding-provider.js";

import {
  assertNonEmptyText,
  assertNonEmptyTexts,
  assertVectorDimensions
} from "../utils/validate-embedding-input.js";

/**
 * Application-facing embedding facade.
 *
 * Inject any EmbeddingProvider; defaults to DeterministicEmbeddingProvider
 * so callers can run without remote credentials.
 */
export class EmbeddingService {

  constructor(
    private readonly provider: EmbeddingProvider =
      new DeterministicEmbeddingProvider()
  ) {}

  getProvider(): EmbeddingProvider {
    return this.provider;
  }

  async embedDocuments(
    texts: string[]
  ): Promise<EmbeddingResult[]> {

    const normalized =
      assertNonEmptyTexts(texts);

    const vectors =
      await this.provider.embedDocuments(
        normalized
      );

    assertVectorDimensions(
      vectors,
      this.provider.dimensions
    );

    if (vectors.length !== normalized.length) {
      throw new EmbeddingError(
        "PROVIDER_COUNT_MISMATCH",
        `Provider returned ${vectors.length} vectors for ${normalized.length} texts`
      );
    }

    return vectors.map(
      vector => this.toResult(vector)
    );

  }

  async embedQuery(
    text: string
  ): Promise<EmbeddingResult> {

    const normalized =
      assertNonEmptyText(text);

    const vector =
      await this.provider.embedQuery(
        normalized
      );

    assertVectorDimensions(
      [vector],
      this.provider.dimensions
    );

    return this.toResult(vector);

  }

  private toResult(
    vector: EmbeddingVector
  ): EmbeddingResult {

    return {

      vector,

      model: this.provider.model,

      dimensions: this.provider.dimensions,

      metadata: {
        provider: this.provider.id
      }

    };

  }

}
