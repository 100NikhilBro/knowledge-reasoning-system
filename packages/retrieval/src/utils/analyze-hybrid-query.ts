export type HybridPreference =
  | "graph"
  | "vector"
  | "balanced";

export interface HybridQueryAnalysis {

  preference: HybridPreference;

  /**
   * Whether the query names relationship-oriented structure.
   */
  relationshipOriented: boolean;

  /**
   * Whether the query looks primarily conceptual / paraphrase-like.
   */
  conceptual: boolean;

  /**
   * Normalized topic codes found in the query (pep484, …).
   */
  topicCodes: string[];

}

const TOPIC_CODE_PATTERN =
  /\b([A-Za-z]{1,16})[-_\s]?(\d{1,6}[A-Za-z]?)\b/g;

const RELATIONSHIP_CUES = [
  "who proposed",
  "proposed by",
  "who authored",
  "authored by",
  "relationship between",
  "what feature",
  "which feature",
  "what concern",
  "which concern",
  "what decision",
  "which decision",
  "introduced",
  "introduces",
  "addressed",
  "addresses",
  "resulted",
  "results in",
  "connected",
  "connect through",
  "multiple hops"
];

const CONCEPTUAL_CUES = [
  "what is",
  "what are",
  "explain",
  "describe",
  "meaning",
  "about",
  "concept",
  "idea",
  "overview",
  "summary"
];

function extractTopicCodes(query: string): string[] {
  const found = new Set<string>();
  TOPIC_CODE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOPIC_CODE_PATTERN.exec(query)) !== null) {
    const family = match[1]?.toLowerCase() ?? "";
    const number = match[2]?.toLowerCase() ?? "";
    if (family && number) {
      found.add(`${family}${number}`);
    }
  }
  return [...found];
}

/**
 * Lightweight query analysis for hybrid source preference.
 * Does not replace the reasoning planner — only guides retrieval fusion.
 */
export function analyzeHybridQuery(
  query: string
): HybridQueryAnalysis {

  const normalized =
    query.trim().toLowerCase();

  const topicCodes =
    extractTopicCodes(query);

  const relationshipOriented =
    RELATIONSHIP_CUES.some(cue =>
      normalized.includes(cue)
    );

  const conceptual =
    CONCEPTUAL_CUES.some(cue =>
      normalized.includes(cue)
    ) &&
    !relationshipOriented;

  let preference: HybridPreference =
    "balanced";

  if (relationshipOriented && !conceptual) {
    preference = "graph";
  } else if (
    conceptual &&
    topicCodes.length === 0 &&
    !relationshipOriented
  ) {
    preference = "vector";
  } else if (
    conceptual &&
    topicCodes.length > 0
  ) {
    /*
     * "What is PEP-484?" — entity lookup + semantics → balanced.
     */
    preference = "balanced";
  } else if (relationshipOriented) {
    preference = "graph";
  }

  return {
    preference,
    relationshipOriented,
    conceptual,
    topicCodes
  };

}
