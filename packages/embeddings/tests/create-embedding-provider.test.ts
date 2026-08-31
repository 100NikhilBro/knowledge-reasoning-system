import { describe, expect, it } from "vitest";

import { resolveEmbeddingConfig }
from "../src/config/resolve-embedding-config.js";

import { createEmbeddingProvider }
from "../src/factories/create-embedding-provider.js";

import { createEmbeddingProviderFromEnv }
from "../src/factories/create-embedding-provider.js";

import { EmbeddingError }
from "../src/errors/embedding-error.js";

describe("resolveEmbeddingConfig", () => {

  it("defaults to the deterministic provider", () => {

    const config =
      resolveEmbeddingConfig({});

    expect(config).toMatchObject({
      provider: "deterministic",
      model: "deterministic-hash-v1",
      dimensions: 32,
      timeoutMs: 30_000,
      maxBatchSize: 64
    });

  });

  it("reads openai-compatible settings from env", () => {

    const config =
      resolveEmbeddingConfig({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_MODEL: "text-embedding-3-large",
        EMBEDDING_DIMENSIONS: "256",
        EMBEDDING_API_KEY: "secret",
        EMBEDDING_BASE_URL: "https://example.test/v1",
        EMBEDDING_TIMEOUT_MS: "15000",
        EMBEDDING_MAX_BATCH_SIZE: "8"
      });

    expect(config).toEqual({
      provider: "openai-compatible",
      model: "text-embedding-3-large",
      dimensions: 256,
      apiKey: "secret",
      baseUrl: "https://example.test/v1",
      timeoutMs: 15_000,
      maxBatchSize: 8
    });

  });

  it("requires EMBEDDING_DIMENSIONS for openai-compatible", () => {

    expect(() =>
      resolveEmbeddingConfig({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_API_KEY: "secret"
      })
    ).toThrow(EmbeddingError);

    expect(() =>
      resolveEmbeddingConfig({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_API_KEY: "secret"
      })
    ).toThrow(/EMBEDDING_DIMENSIONS is required/);

  });

  it("defaults openai-compatible model when unset", () => {

    const config =
      resolveEmbeddingConfig({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_DIMENSIONS: "1536",
        EMBEDDING_API_KEY: "secret"
      });

    expect(config.model).toBe("text-embedding-3-small");
    expect(config.dimensions).toBe(1536);

  });

  it("rejects unknown providers", () => {

    expect(() =>
      resolveEmbeddingConfig({
        EMBEDDING_PROVIDER: "local-gguf"
      })
    ).toThrow(EmbeddingError);

  });

});

describe("createEmbeddingProvider", () => {

  it("creates a deterministic provider", () => {

    const provider =
      createEmbeddingProvider({
        provider: "deterministic",
        model: "deterministic-hash-v1",
        dimensions: 16
      });

    expect(provider.id).toBe("deterministic");
    expect(provider.dimensions).toBe(16);

  });

  it("requires an api key for openai-compatible", () => {

    expect(() =>
      createEmbeddingProvider({
        provider: "openai-compatible",
        model: "text-embedding-3-small",
        dimensions: 8
      })
    ).toThrow(EmbeddingError);

  });

  it("creates a provider from env defaults", () => {

    const provider =
      createEmbeddingProviderFromEnv({
        EMBEDDING_PROVIDER: "deterministic",
        EMBEDDING_DIMENSIONS: "10"
      });

    expect(provider.id).toBe("deterministic");
    expect(provider.dimensions).toBe(10);

  });

});
