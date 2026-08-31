import type { ParsedDocument } from "@knowledge/parser";

/**
 * Derive a stable source label from parsed metadata without hardcoding
 * a single sample document name.
 */
export function resolveDocumentSource(
  document: ParsedDocument
): string {

  const pep =
    document.metadata.pep?.trim();

  if (pep) {
    return `pep-${pep}.md`;
  }

  return "document";

}
