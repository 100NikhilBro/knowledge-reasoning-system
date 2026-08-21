
import type { MemoryKey } from "../types/memory-key.js";

export function buildMemoryKey(
  memoryKey: MemoryKey
): string {

  return `${memoryKey.namespace}:${memoryKey.key}`;

}