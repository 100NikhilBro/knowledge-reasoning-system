import type { SessionStateStore }
  from "../contracts/session-state-store.js";

import type { SessionState }
  from "../types/session-state.js";

import { RedisWorkingMemory }
  from "./redis-working-memory.js";

export class RedisSessionStateStore
  implements SessionStateStore {

  constructor(
    private readonly memory =
      new RedisWorkingMemory()
  ) {}

  async save(
    sessionId: string,
    state: SessionState
  ): Promise<void> {

    await this.memory.set(

      "session",

      {
        key: sessionId,
        value: JSON.stringify(state)
      }

    );

  }

  async load(
    sessionId: string
  ): Promise<SessionState | null> {

    const entry =
      await this.memory.get(
        "session",
        sessionId
      );

    if (entry === null) {

      return null;

    }

    return JSON.parse(
      entry.value
    ) as SessionState;

  }

  async clear(
    sessionId: string
  ): Promise<void> {

    await this.memory.delete(
      "session",
      sessionId
    );

  }

  async close(): Promise<void> {

    await this.memory.close();

  }

}