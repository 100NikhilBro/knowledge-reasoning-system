import { describe, expect, it, vi } from "vitest";

import { OpenAICompatibleEmbeddingProvider }
from "../src/providers/openai-compatible.embedding-provider.js";

import { EmbeddingError }
from "../src/errors/embedding-error.js";

describe("OpenAICompatibleEmbeddingProvider", () => {

  it("requires an api key", () => {

    expect(() =>
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 8,
        apiKey: ""
      })
    ).toThrow(EmbeddingError);

  });

  it("embeds a query via the compatible HTTP API", async () => {

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                index: 0,
                embedding: [0.1, 0.2, 0.3, 0.4]
              }
            ],
            model: "text-embedding-3-small"
          }),
          { status: 200 }
        )
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        baseUrl: "https://example.test/v1",
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    const vector =
      await provider.embedQuery("type hints");

    expect(vector).toEqual([0.1, 0.2, 0.3, 0.4]);

    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] =
      fetchImpl.mock.calls[0];

    expect(url).toBe(
      "https://example.test/v1/embeddings"
    );

    expect(init?.method).toBe("POST");

    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key"
    });

    expect(JSON.parse(String(init?.body))).toEqual({
      model: "text-embedding-3-small",
      input: "type hints",
      dimensions: 4
    });

  });

  it("embeds documents and preserves response order", async () => {

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                index: 1,
                embedding: [0, 1, 0, 0]
              },
              {
                index: 0,
                embedding: [1, 0, 0, 0]
              }
            ]
          }),
          { status: 200 }
        )
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    const vectors =
      await provider.embedDocuments([
        "first",
        "second"
      ]);

    expect(vectors).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, 0]
    ]);

  });

  it("surfaces provider HTTP errors", async () => {

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "invalid api key"
            }
          }),
          { status: 401 }
        )
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "bad-key",
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    await expect(
      provider.embedQuery("hello")
    ).rejects.toMatchObject({
      code: "PROVIDER_HTTP_ERROR",
      message: "invalid api key"
    });

  });

  it("rejects dimension mismatches from the provider", async () => {

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                index: 0,
                embedding: [1, 2]
              }
            ]
          }),
          { status: 200 }
        )
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    await expect(
      provider.embedQuery("hello")
    ).rejects.toMatchObject({
      code: "DIMENSION_MISMATCH"
    });

  });

  it("rejects empty document batches", async () => {

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        fetchImpl: vi.fn() as unknown as typeof fetch
      });

    await expect(
      provider.embedDocuments([])
    ).rejects.toMatchObject({
      code: "INVALID_INPUT"
    });

  });

  it("rejects malformed JSON responses", async () => {

    const fetchImpl = vi.fn(
      async () =>
        new Response("not-json", { status: 200 })
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    await expect(
      provider.embedQuery("hello")
    ).rejects.toMatchObject({
      code: "PROVIDER_INVALID_JSON"
    });

  });

  it("rejects empty provider payloads", async () => {

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: [] }),
          { status: 200 }
        )
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    await expect(
      provider.embedQuery("hello")
    ).rejects.toMatchObject({
      code: "PROVIDER_EMPTY_RESPONSE"
    });

  });

  it("maps AbortError to PROVIDER_TIMEOUT", async () => {

    const fetchImpl = vi.fn(
      async (_url: string, init?: RequestInit) => {

        const error = new Error("aborted");
        error.name = "AbortError";

        if (init?.signal?.aborted) {
          throw error;
        }

        throw error;

      }
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        timeoutMs: 1,
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    await expect(
      provider.embedQuery("hello")
    ).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT"
    });

  });

  it("redacts api keys from provider failure messages", async () => {

    const secret = "sk-super-secret-key-value";

    const fetchImpl = vi.fn(
      async () => {
        throw new Error(
          `upstream failed for Bearer ${secret}`
        );
      }
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: secret,
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    await expect(
      provider.embedQuery("hello")
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toMatchObject({
        code: "PROVIDER_REQUEST_FAILED"
      });

      expect(String(error)).not.toContain(secret);
      expect(String(error)).toContain("[REDACTED]");

      return true;
    });

  });

  it("uses the same vector space for documents and queries", async () => {

    const fetchImpl = vi.fn(
      async (_url: string, init?: RequestInit) => {

        const body =
          JSON.parse(String(init?.body)) as {
            input: string | string[];
          };

        const count =
          Array.isArray(body.input) ? body.input.length : 1;

        return new Response(
          JSON.stringify({
            data: Array.from({ length: count }, (_, index) => ({
              index,
              embedding: [0.25, 0.25, 0.25, 0.25]
            }))
          }),
          { status: 200 }
        );

      }
    );

    const provider =
      new OpenAICompatibleEmbeddingProvider({
        model: "text-embedding-3-small",
        dimensions: 4,
        apiKey: "test-key",
        fetchImpl: fetchImpl as unknown as typeof fetch
      });

    const [document] =
      await provider.embedDocuments(["Python type hints"]);

    const query =
      await provider.embedQuery("Python type hints");

    expect(document).toHaveLength(4);
    expect(query).toHaveLength(4);
    expect(document).toEqual(query);

  });

});
