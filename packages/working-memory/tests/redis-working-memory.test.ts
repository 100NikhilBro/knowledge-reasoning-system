import { describe, expect, it } from "vitest";

import { RedisWorkingMemory } from "../src/redis/redis-working-memory.js";

describe("RedisWorkingMemory", () => {

  it("stores and retrieves a memory entry", async () => {

    const memory =
      new RedisWorkingMemory();

    const namespace =
      "test-session";

    const entry = {
      key: "test:key",
      value: "hello"
    };

    await memory.set(
      namespace,
      entry
    );

    const result =
      await memory.get(
        namespace,
        entry.key
      );

    expect(result).toEqual(entry);

    await memory.delete(
      namespace,
      entry.key
    );

    await memory.close();

  });


  it("returns null for missing memory", async () => {

    const memory =
      new RedisWorkingMemory();

    const namespace =
      "test-session";

    const result =
      await memory.get(
        namespace,
        "missing:key"
      );

    expect(result).toBeNull();

    await memory.close();

  });


  it("deletes a memory entry", async () => {

    const memory =
      new RedisWorkingMemory();

    const namespace =
      "test-session";

    await memory.set(
      namespace,
      {
        key: "delete:key",
        value: "temporary"
      }
    );

    await memory.delete(
      namespace,
      "delete:key"
    );

    const result =
      await memory.get(
        namespace,
        "delete:key"
      );

    expect(result).toBeNull();

    await memory.close();

  });


  it("expires a memory entry after ttl", async () => {

    const memory =
      new RedisWorkingMemory();

    const namespace =
      "ttl-session";

    await memory.set(
      namespace,
      {
        key: "ttl:key",
        value: "temporary",
        ttl: 1
      }
    );

    const immediate =
      await memory.get(
        namespace,
        "ttl:key"
      );

    expect(immediate).toEqual({
      key: "ttl:key",
      value: "temporary",
      ttl: 1
    });

    await new Promise(
      resolve =>
        setTimeout(resolve, 1500)
    );

    const expired =
      await memory.get(
        namespace,
        "ttl:key"
      );

    expect(expired).toBeNull();

    await memory.close();

  });


  it("checks whether a memory entry exists", async () => {

    const memory =
      new RedisWorkingMemory();

    const namespace =
      "has-session";

    const entry = {
      key: "has-key",
      value: "hello"
    };

    await memory.set(
      namespace,
      entry
    );

    await expect(
      memory.has(
        namespace,
        "has-key"
      )
    ).resolves.toBe(true);

    await expect(
      memory.has(
        namespace,
        "missing-key"
      )
    ).resolves.toBe(false);

    await memory.delete(
      namespace,
      "has-key"
    );

    await memory.close();

  });


  it("isolates memories by namespace", async () => {

    const memory =
      new RedisWorkingMemory();

    await memory.set(
      "session-a",
      {
        key: "state",
        value: "A"
      }
    );

    await memory.set(
      "session-b",
      {
        key: "state",
        value: "B"
      }
    );

    await expect(
      memory.get(
        "session-a",
        "state"
      )
    ).resolves.toEqual({
      key: "state",
      value: "A"
    });

    await expect(
      memory.get(
        "session-b",
        "state"
      )
    ).resolves.toEqual({
      key: "state",
      value: "B"
    });

    await memory.clear(
      "session-a"
    );

    await memory.clear(
      "session-b"
    );

    await expect(
      memory.get(
        "session-a",
        "state"
      )
    ).resolves.toBeNull();

    await expect(
      memory.get(
        "session-b",
        "state"
      )
    ).resolves.toBeNull();

    await memory.close();

  });

});