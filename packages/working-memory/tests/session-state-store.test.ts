import {
  describe,
  expect,
  it
} from "vitest";

import {
  RedisSessionStateStore
} from "../src/redis/redis-session-state-store.js";

describe("RedisSessionStateStore", () => {

  it("saves and loads session state", async () => {

    const store =
      new RedisSessionStateStore();

    const state = {
      sessionId: "session-1",
      query: "What is RAG?",
      status: "active"
    };

    await store.save(
      "session-1",
      state
    );

    const result =
      await store.load("session-1");

    expect(result).toEqual(state);

    await store.clear("session-1");

    await store.close();

  });

  it("returns null for missing session", async () => {

    const store =
      new RedisSessionStateStore();

    const result =
      await store.load("missing-session");

    expect(result).toBeNull();

    await store.close();

  });

  it("clears session state", async () => {

    const store =
      new RedisSessionStateStore();

    const state = {
      sessionId: "session-2",
      query: "Explain embeddings",
      status: "active"
    };

    await store.save(
      "session-2",
      state
    );

    await store.clear("session-2");

    const result =
      await store.load("session-2");

    expect(result).toBeNull();

    await store.close();

  });

});