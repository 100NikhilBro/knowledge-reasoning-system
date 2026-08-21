import type { SessionState } from "../types/session-state.js";

export interface SessionStateStore {

  save(
    sessionId: string,
    state: SessionState
  ): Promise<void>;

  load(
    sessionId: string
  ): Promise<SessionState | null>;

  clear(
    sessionId: string
  ): Promise<void>;

}