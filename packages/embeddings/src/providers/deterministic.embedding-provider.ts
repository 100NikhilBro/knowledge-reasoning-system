import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import type { EmbeddingVector } from "../types/embedding-vector.js";

import {
  assertNonEmptyText,
  assertNonEmptyTexts
} from "../utils/validate-embedding-input.js";

import { normalizeVector } from "../utils/normalize-vector.js";

export interface DeterministicEmbeddingProviderOptions {

  model?: string;

  dimensions?: number;

  maxBatchSize?: number;

}

/**
 * Local, deterministic embedding provider.
 *
 * Suitable for unit tests and offline development.
 * Not a semantic model — vectors are derived from text hashes.
 */
export class DeterministicEmbeddingProvider
  implements EmbeddingProvider {

  readonly id = "deterministic";

  readonly model: string;

  readonly dimensions: number;

  private readonly maxBatchSize: number;

  constructor(
    options: DeterministicEmbeddingProviderOptions = {}
  ) {

    this.model =
      options.model ?? "deterministic-hash-v1";

    this.dimensions =
      options.dimensions ?? 32;

    this.maxBatchSize =
      options.maxBatchSize ?? 64;

    if (
      !Number.isInteger(this.dimensions) ||
      this.dimensions < 2
    ) {
      throw new Error(
        "dimensions must be an integer >= 2"
      );
    }

  }

  async embedDocuments(
    texts: string[]
  ): Promise<EmbeddingVector[]> {

    const normalized =
      assertNonEmptyTexts(
        texts,
        this.maxBatchSize
      );

    return normalized.map(
      text => this.embedText(text)
    );

  }

  async embedQuery(
    text: string
  ): Promise<EmbeddingVector> {

    const normalized =
      assertNonEmptyText(text);

    return this.embedText(normalized);

  }

  private embedText(
    text: string
  ): number[] {

    const values =
      new Array<number>(this.dimensions).fill(0);

    const tokens =
      text
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const source =
      tokens.length > 0
        ? tokens
        : [text.toLowerCase()];

    for (const token of source) {

      let hash = 2166136261;

      for (let index = 0; index < token.length; index++) {
        hash ^= token.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }

      const bucket =
        Math.abs(hash) % this.dimensions;

      const sign =
        (hash & 1) === 0 ? 1 : -1;

      values[bucket] += sign;

      const neighbor =
        (bucket + 1) % this.dimensions;

      values[neighbor] += sign * 0.5;

    }

    return normalizeVector(values);

  }

}
