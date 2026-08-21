import type { SessionState }
  from "@knowledge/working-memory";

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