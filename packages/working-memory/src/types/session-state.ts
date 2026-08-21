import type { MemoryState } from "./memory-state.js";

export interface SessionState {

  sessionId: string;

  memory: MemoryState;

  history: MemoryState[];

}