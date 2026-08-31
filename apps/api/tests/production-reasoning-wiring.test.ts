import { describe, expect, it, vi } from "vitest";

vi.mock("@knowledge/retriever", async () => {
  const actual = await vi.importActual<typeof import("@knowledge/retriever")>(
    "@knowledge/retriever"
  );

  return {
    ...actual,
    createRetrievalServiceFromEnv: vi.fn(() => {
      return new actual.RetrievalService(
        new actual.Neo4jGraphRetriever(),
        new actual.DummyVectorRetriever()
      );
    })
  };
});

vi.mock("@knowledge/working-memory", async () => {
  const actual = await vi.importActual<
    typeof import("@knowledge/working-memory")
  >("@knowledge/working-memory");

  class FakeRedisSessionStateStore {
    load = vi.fn(async () => []);
    append = vi.fn(async () => undefined);
  }

  return {
    ...actual,
    RedisSessionStateStore: vi
      .fn()
      .mockImplementation(function RedisSessionStateStore() {
        return new FakeRedisSessionStateStore();
      })
  };
});

import { createRetrievalServiceFromEnv } from "@knowledge/retriever";
import { RedisSessionStateStore } from "@knowledge/working-memory";
import { DefaultEvidenceCollector } from "@knowledge/reasoning";

import { createProductionReasoningEngine } from "../src/factories/create-production-reasoning-engine.js";

describe("createProductionReasoningEngine", () => {
  it("wires hybrid retrieval from env and a Redis session store", () => {
    const env = {
      QDRANT_URL: "http://localhost:6333",
      EMBEDDING_PROVIDER: "deterministic",
      EMBEDDING_DIMENSIONS: "32",
      LLM_PROVIDER: "groq",
      GROQ_API_KEY: "test-not-a-real-secret"
    } as NodeJS.ProcessEnv;

    const engine = createProductionReasoningEngine(env);

    expect(createRetrievalServiceFromEnv).toHaveBeenCalledWith(env);
    expect(RedisSessionStateStore).toHaveBeenCalledOnce();
    expect(engine).toBeTruthy();

    const collector = (
      engine as unknown as {
        collector: DefaultEvidenceCollector;
      }
    ).collector;

    expect(collector).toBeInstanceOf(DefaultEvidenceCollector);
  });
});
