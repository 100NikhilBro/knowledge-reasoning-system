import { describe, expect, it } from "vitest";

import { DeterministicEmbeddingProvider }
from "../src/providers/deterministic.embedding-provider.js";

import { EmbeddingError }
from "../src/errors/embedding-error.js";

describe("DeterministicEmbeddingProvider", () => {

  it("embeds documents with the configured dimensions", async () => {

    const provider =
      new DeterministicEmbeddingProvider({
        dimensions: 16
      });

    const vectors =
      await provider.embedDocuments([
        "Type Hints",
        "PEP 484"
      ]);

    expect(vectors).toHaveLength(2);

    for (const vector of vectors) {
      expect(vector).toHaveLength(16);
      expect(
        vector.every(
          value => Number.isFinite(value)
        )
      ).toBe(true);
    }

  });

  it("returns identical vectors for identical inputs", async () => {

    const provider =
      new DeterministicEmbeddingProvider();

    const first =
      await provider.embedQuery("PEP-484 Type Hints");

    const second =
      await provider.embedQuery("PEP-484 Type Hints");

    expect(first).toEqual(second);

  });

  it("returns different vectors for different inputs", async () => {

    const provider =
      new DeterministicEmbeddingProvider();

    const first =
      await provider.embedQuery("type hints");

    const second =
      await provider.embedQuery("async await");

    expect(first).not.toEqual(second);

  });

  it("produces unit-length vectors", async () => {

    const provider =
      new DeterministicEmbeddingProvider({
        dimensions: 8
      });

    const vector =
      await provider.embedQuery("normalization check");

    const magnitude =
      Math.sqrt(
        vector.reduce(
          (sum, value) => sum + value * value,
          0
        )
      );

    expect(magnitude).toBeCloseTo(1, 5);

  });

  it("rejects empty document batches", async () => {

    const provider =
      new DeterministicEmbeddingProvider();

    await expect(
      provider.embedDocuments([])
    ).rejects.toBeInstanceOf(EmbeddingError);

  });

  it("rejects blank query text", async () => {

    const provider =
      new DeterministicEmbeddingProvider();

    await expect(
      provider.embedQuery("   ")
    ).rejects.toMatchObject({
      code: "INVALID_INPUT"
    });

  });

});
