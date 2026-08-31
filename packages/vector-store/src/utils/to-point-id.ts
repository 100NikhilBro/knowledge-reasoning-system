import { createHash } from "node:crypto";

/**
 * Map an arbitrary entity id to a deterministic UUID suitable for Qdrant point ids.
 */
export function toPointId(
  entityId: string
): string {

  const hex =
    createHash("sha256")
      .update(entityId)
      .digest("hex");

  const bytes =
    Buffer.from(hex.slice(0, 32), "hex");

  // RFC 4122 variant + version 5-style markers
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const normalized =
    bytes.toString("hex");

  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20),
    normalized.slice(20, 32)
  ].join("-");

}
