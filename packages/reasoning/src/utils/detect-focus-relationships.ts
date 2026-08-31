/**
 * Infer relationship types the query is asking about.
 *
 * Returns every matched focus (not only the first) so compound questions
 * that ask about multiple relationships can expand each edge type.
 *
 * Used to expand/filter graph neighbors for relationship-oriented questions
 * without treating every connected entity as relevant evidence.
 */
export function detectFocusRelationships(
  query: string
): string[] | undefined {

  const normalized =
    query.toLowerCase();

  const focuses: string[] = [];

  if (
    normalized.includes("who proposed") ||
    normalized.includes("proposed by") ||
    normalized.includes("who authored") ||
    normalized.includes("authored by")
  ) {
    focuses.push("PROPOSED_BY");
  }

  if (
    normalized.includes("what concern") ||
    normalized.includes("which concern") ||
    (
      normalized.includes("concern") &&
      (
        normalized.includes("address") ||
        normalized.includes("addresses") ||
        normalized.includes("addressed")
      )
    )
  ) {
    focuses.push("ADDRESSES");
  }

  if (
    normalized.includes("what feature") ||
    normalized.includes("which feature") ||
    (
      normalized.includes("feature") &&
      normalized.includes("introduce")
    )
  ) {
    focuses.push("INTRODUCES");
  }

  if (
    normalized.includes("what decision") ||
    normalized.includes("which decision") ||
    (
      normalized.includes("decision") &&
      normalized.includes("result")
    ) ||
    (
      normalized.includes("status") &&
      normalized.includes("result")
    )
  ) {
    focuses.push("RESULTS_IN");
  }

  /*
   * Ask for IMPLEMENTED_IN when the query clearly seeks a Python version
   * implementation edge. If the graph has no such edge, single-hop keeps
   * any other focused hits (e.g. RESULTS_IN → Decision) for partial grounding.
   */
  if (
    (
      normalized.includes("python version") ||
      normalized.includes("python-version")
    ) &&
    (
      normalized.includes("implement") ||
      normalized.includes("implemented") ||
      normalized.includes("implements")
    )
  ) {
    focuses.push("IMPLEMENTED_IN");
  }

  return focuses.length > 0
    ? focuses
    : undefined;

}
