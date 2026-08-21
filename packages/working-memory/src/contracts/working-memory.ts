import type { MemoryEntry } from "../types/memory-entry.js";

export interface WorkingMemory {

  set(
    namespace: string,
    entry: MemoryEntry
  ): Promise<void>;

  get(
    namespace: string,
    key: string
  ): Promise<MemoryEntry | null>;

  has(
    namespace: string,
    key: string
  ): Promise<boolean>;

  delete(
    namespace: string,
    key: string
  ): Promise<void>;

  clear(
    namespace: string
  ): Promise<void>;

}