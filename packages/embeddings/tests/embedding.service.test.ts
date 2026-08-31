import { describe, expect, it, vi } from "vitest";

import type { EmbeddingProvider }
from "../src/contracts/embedding-provider.js";

import { EmbeddingService }
from "../src/services/embedding.service.js";

import { DeterministicEmbeddingProvider }
from "../src/providers/deterministic.embedding-provider.js";

import { EmbeddingError }
from "../src/errors/embedding-error.js";

describe("EmbeddingService", () => {

  it("defaults to the deterministic provider", async () => {

    const service =
      new EmbeddingService();

    expect(service.getProvider().id)
      .toBe("deterministic");

    const result =
      await service.embedQuery("hello world");

    expect(result.dimensions)
      .toBe(service.getProvider().dimensions);

    expect(result.metadata)
      .toEqual({ provider: "deterministic" });

  });

  it("embeds documents through the injected provider", async () => {

    const provider =
      new DeterministicEmbeddingProvider({
        dimensions: 12,
        model: "test-model"
      });

    const service =
      new EmbeddingService(provider);

    const results =
      await service.embedDocuments([
        "document one",
        "document two"
      ]);

    expect(results).toHaveLength(2);

    expect(results[0].model).toBe("test-model");
    expect(results[0].vector).toHaveLength(12);
    expect(results[1].vector).toHaveLength(12);

  });

  it("allows replacing the provider via constructor DI", async () => {

    const stub: EmbeddingProvider = {
      id: "stub",
      model: "stub-model",
      dimensions: 3,
      embedDocuments: vi.fn(async () => [
        [1, 0, 0],
        [0, 1, 0]
      ]),
      embedQuery: vi.fn(async () => [0, 0, 1])
    };

    const service =
      new EmbeddingService(stub);

    const documents =
      await service.embedDocuments([
        "a",
        "b"
      ]);

    const query =
      await service.embedQuery("q");

    expect(stub.embedDocuments)
      .toHaveBeenCalledWith(["a", "b"]);

    expect(stub.embedQuery)
      .toHaveBeenCalledWith("q");

    expect(documents[0].vector).toEqual([1, 0, 0]);
    expect(query.vector).toEqual([0, 0, 1]);
    expect(query.metadata).toEqual({
      provider: "stub"
    });

  });

  it("rejects provider output with wrong dimensions", async () => {

    const stub: EmbeddingProvider = {
      id: "bad",
      model: "bad-model",
      dimensions: 4,
      embedDocuments: async () => [[1, 2]],
      embedQuery: async () => [1, 2]
    };

    const service =
      new EmbeddingService(stub);

    await expect(
      service.embedQuery("query")
    ).rejects.toBeInstanceOf(EmbeddingError);

  });

});
