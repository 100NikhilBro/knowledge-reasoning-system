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
    normalized.includes("authored by") ||
    normalized.includes("who did it come from") ||
    normalized.includes("where did it come from")
  ) {
    focuses.push("PROPOSED_BY");
  }

  /*
   * Concern / problem / address language — including HOW/WHY phrasing.
   */
  if (
    normalized.includes("what concern") ||
    normalized.includes("which concern") ||
    normalized.includes("what problem") ||
    normalized.includes("which problem") ||
    (
      (
        normalized.includes("concern") ||
        normalized.includes("problem")
      ) &&
      (
        normalized.includes("address") ||
        normalized.includes("addresses") ||
        normalized.includes("addressed") ||
        normalized.includes("solve") ||
        normalized.includes("solved")
      )
    ) ||
    (
      normalized.includes("how") &&
      (
        normalized.includes("address") ||
        normalized.includes("addresses") ||
        normalized.includes("addressed")
      )
    ) ||
    (
      normalized.includes("why") &&
      (
        normalized.includes("proposed") ||
        normalized.includes("introduce") ||
        normalized.includes("introduced") ||
        normalized.includes("needed") ||
        normalized.includes("created")
      )
    )
  ) {
    focuses.push("ADDRESSES");
  }

  /*
   * Feature / introduction language — including "what did it introduce".
   */
  if (
    normalized.includes("what feature") ||
    normalized.includes("which feature") ||
    normalized.includes("what did it introduce") ||
    normalized.includes("what does it introduce") ||
    (
      normalized.includes("feature") &&
      normalized.includes("introduce")
    ) ||
    (
      (
        normalized.includes("introduce") ||
        normalized.includes("introduced") ||
        normalized.includes("introduces")
      ) &&
      !normalized.includes("why was")
    )
  ) {
    focuses.push("INTRODUCES");
  }

  /*
   * WHY questions about a proposal often need the introduced capability
   * as part of the explanatory chain (proposal → feature → concern).
   */
  if (
    normalized.includes("why") &&
    (
      normalized.includes("proposed") ||
      normalized.includes("introduced") ||
      normalized.includes("needed")
    ) &&
    !focuses.includes("INTRODUCES")
  ) {
    focuses.push("INTRODUCES");
  }

  if (
    normalized.includes("what decision") ||
    normalized.includes("which decision") ||
    normalized.includes("ultimately made") ||
    normalized.includes("final decision") ||
    (
      normalized.includes("decision") &&
      (
        normalized.includes("result") ||
        normalized.includes("made") ||
        normalized.includes("accepted")
      )
    ) ||
    (
      normalized.includes("status") &&
      normalized.includes("result")
    )
  ) {
    focuses.push("RESULTS_IN");
  }

  /*
   * Ask for IMPLEMENTED_IN when the query clearly seeks a version
   * implementation edge. Domain-agnostic: "version" + implement*.
   */
  if (
    (
      normalized.includes("python version") ||
      normalized.includes("python-version") ||
      (
        normalized.includes("version") &&
        normalized.includes("implement")
      )
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
    ? [...new Set(focuses)]
    : undefined;

}

/**
 * Queries that need a multi-hop relationship chain (not just one focused hop).
 */
export function detectMultiHopPathQuery(
  query: string
): boolean {

  const normalized =
    query.toLowerCase();

  if (normalized.includes("multiple hops")) {
    return true;
  }

  if (
    normalized.includes("related entities connect") ||
    normalized.includes("connect through multiple")
  ) {
    return true;
  }

  if (
    normalized.includes("how") &&
    normalized.includes("connected")
  ) {
    return true;
  }

  if (
    normalized.includes("through") &&
    (
      normalized.includes("connect") ||
      normalized.includes("how") ||
      normalized.includes("via") ||
      normalized.includes("linked")
    )
  ) {
    return true;
  }

  if (
    normalized.includes("via") &&
    (
      normalized.includes("how") ||
      normalized.includes("connect") ||
      normalized.includes("linked")
    )
  ) {
    return true;
  }

  return false;

}

/**
 * Queries whose answers require relationship-backed evidence (not label-only).
 */
export function queryRequiresRelationalEvidence(
  query: string
): boolean {

  const normalized =
    query.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (detectMultiHopPathQuery(query)) {
    return true;
  }

  if (
    /\bwhy\b/.test(normalized) ||
    /\bhow\b/.test(normalized)
  ) {
    return true;
  }

  if (detectRelationshipCue(normalized)) {
    return true;
  }

  const focuses =
    detectFocusRelationships(query);

  return Boolean(focuses && focuses.length > 0);

}

function detectRelationshipCue(
  normalized: string
): boolean {

  return (
    normalized.includes("who proposed") ||
    normalized.includes("proposed by") ||
    normalized.includes("relationship between") ||
    normalized.includes("what feature") ||
    normalized.includes("what concern") ||
    normalized.includes("what decision") ||
    normalized.includes("what problem")
  );

}
