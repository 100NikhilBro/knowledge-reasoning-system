import type { KnowledgeEntity } from "@knowledge/shared";

/**
 * Build a stable, informative text representation for embedding a KnowledgeEntity.
 */
export function buildEntityEmbeddingText(
  entity: KnowledgeEntity
): string {

  const parts: string[] = [
    entity.type,
    entity.label,
    entity.source
  ];

  const properties =
    entity.properties ?? {};

  for (const [key, value] of Object.entries(properties)) {

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      parts.push(`${key}: ${String(value)}`);
    }

  }

  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(" | ");

}
