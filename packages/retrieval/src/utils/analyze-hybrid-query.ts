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

  /**
   * P2 intent when provided by the caller.
   */
  intent?: string;

  /**
   * Exact-identifier / lexical signal (PEP codes, dotted names).
   */
  lexicalSignals: string[];

}

const TOPIC_CODE_PATTERN =
  /\b([A-Za-z]{1,16})[-_\s]?(\d{1,6}[A-Za-z]?)\b/g;

const DOTTED_IDENTIFIER_PATTERN =
  /\b[a-z][a-z0-9_]*(?:\.[A-Za-z_][\w]*)+\b/g;

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
  "multiple hops",
  "directly related",
  "directly connected"
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

const GRAPH_INTENTS = new Set([
  "RELATIONSHIP",
  "DIRECT_RELATIONSHIP",
  "CONNECTED_RELATIONSHIP",
  "BRIDGE_RELATIONSHIP",
  "COMPOUND",
  "IMPLICATION",
  "COMPARISON"
]);

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

function extractLexicalSignals(query: string): string[] {
  const signals = new Set<string>();

  for (const code of extractTopicCodes(query)) {
    signals.add(code);
  }

  DOTTED_IDENTIFIER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DOTTED_IDENTIFIER_PATTERN.exec(query)) !== null) {
    if (match[0]) {
      signals.add(match[0]);
    }
  }

  for (const pep of query.matchAll(/\bPEP[\s_-]?(\d+)\b/gi)) {
    signals.add(`pep${pep[1]}`);
    signals.add(`PEP-${pep[1]}`);
  }

  return [...signals];
}

function preferenceFromIntent(
  intent: string | undefined,
  topicCodes: string[],
  relationshipOriented: boolean
): HybridPreference | undefined {

  if (!intent) {
    return undefined;
  }

  if (intent === "OUT_OF_CORPUS") {
    return "vector";
  }

  if (GRAPH_INTENTS.has(intent)) {
    return "graph";
  }

  if (intent === "SUMMARIZATION" || intent === "ANALYTICAL") {
    return "balanced";
  }

  if (intent === "FACT") {
    if (topicCodes.length > 0) {
      return "balanced";
    }
    /*
     * Soft factual paraphrases without identifiers lean semantic.
     */
    return relationshipOriented ? "graph" : "vector";
  }

  if (relationshipOriented) {
    return "graph";
  }

  return undefined;

}

/**
 * Lightweight query analysis for hybrid source preference.
 * Accepts optional P2 intent so retrieval stays aligned without owning reasoning.
 */
export function analyzeHybridQuery(
  query: string,
  options?: {
    intent?: string;
  }
): HybridQueryAnalysis {

  const normalized =
    query.trim().toLowerCase();

  const topicCodes =
    extractTopicCodes(query);

  const lexicalSignals =
    extractLexicalSignals(query);

  const relationshipOriented =
    RELATIONSHIP_CUES.some(cue =>
      normalized.includes(cue)
    );

  const conceptual =
    CONCEPTUAL_CUES.some(cue =>
      normalized.includes(cue)
    ) &&
    !relationshipOriented;

  const fromIntent =
    preferenceFromIntent(
      options?.intent,
      topicCodes,
      relationshipOriented
    );

  let preference: HybridPreference =
    fromIntent ?? "balanced";

  if (!fromIntent) {
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
      preference = "balanced";
    } else if (relationshipOriented) {
      preference = "graph";
    }
  }

  return {
    preference,
    relationshipOriented,
    conceptual,
    topicCodes,
    lexicalSignals,
    ...(options?.intent
      ? { intent: options.intent }
      : {})
  };

}
