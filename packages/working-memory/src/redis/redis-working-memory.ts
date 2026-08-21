import { Redis } from "ioredis";

import type { WorkingMemory } from "../contracts/working-memory.js";
import type { MemoryEntry } from "../types/memory-entry.js";

import { buildMemoryKey } from "../utils/build-memory-key.js";

export class RedisWorkingMemory
  implements WorkingMemory {

  constructor(
    private readonly redis = new Redis(
      process.env.REDIS_URL ?? "redis://localhost:6379"
    )
  ) {}

  async set(
    namespace: string,
    entry: MemoryEntry
  ): Promise<void> {

    const key =
      buildMemoryKey({
        namespace,
        key: entry.key
      });

    const value =
      JSON.stringify(entry);

    if (entry.ttl !== undefined) {

      await this.redis.setex(
        key,
        entry.ttl,
        value
      );

      return;
    }

    await this.redis.set(
      key,
      value
    );
  }

  async get(
    namespace: string,
    key: string
  ): Promise<MemoryEntry | null> {

    const redisKey =
      buildMemoryKey({
        namespace,
        key
      });

    const value =
      await this.redis.get(redisKey);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as MemoryEntry;
  }

  async has(
    namespace: string,
    key: string
  ): Promise<boolean> {

    const redisKey =
      buildMemoryKey({
        namespace,
        key
      });

    const exists =
      await this.redis.exists(redisKey);

    return exists === 1;
  }

  async delete(
    namespace: string,
    key: string
  ): Promise<void> {

    const redisKey =
      buildMemoryKey({
        namespace,
        key
      });

    await this.redis.del(redisKey);
  }

  async clear(
    namespace: string
  ): Promise<void> {

    const pattern =
      `${namespace}:*`;

    let cursor = "0";

    do {

      const [
        nextCursor,
        keys
      ] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );

      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

    } while (cursor !== "0");
  }

  async close(): Promise<void> {

    await this.redis.quit();
  }

}