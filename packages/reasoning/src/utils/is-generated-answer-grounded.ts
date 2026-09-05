import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  buildGroundedCorpus,
  corpusAttests
} from "./build-grounded-corpus.js";

import {
  buildPartialGroundedAnswer,
  buildRelationshipNotEstablishedAnswer
} from "./build-partial-grounded-answer.js";

/**
 * Template answer used by the legacy deterministic generator.
 * Kept for comparison equality and baseline fixtures.
 */
export function templateGroundedAnswer(
  context: ReasoningContext
): string {

  return (
    context.comparison ??
    context.items
      .map(
        item =>
          `${item.entityType}: ${item.label}`
      )
      .join("\n")
  );

}

const ENTITY_ID_PATTERN =
  /\b[a-z][a-z0-9_-]*:[A-Za-z0-9._-]+\b/g;

/**
 * Parameterized / bracketed forms (type syntax, generics, indexed forms).
 * Generic — not tied to any language or knowledge domain.
 */
const PARAMETERIZED_FORM_PATTERN =
  /\b[A-Za-z_][\w.]*\[[^\]]+\]/g;

/**
 * Relationship-style tokens: SCREAMING_SNAKE_CASE with at least one underscore.
 */
const RELATIONSHIP_TOKEN_PATTERN =
  /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;

/**
 * Attribute-style claims: key: value / key = value
 */
const ATTRIBUTE_CLAIM_PATTERN =
  /\b([A-Za-z][\w-]{1,40})\s*[:=]\s*["']?([^,"'\n.;]{1,80})["']?/g;

const ATTRIBUTE_KEY_BLOCKLIST =
  new Set([
    "http",
    "https",
    "note",
    "notes",
    "answer",
    "question",
    "example",
    "examples",
    "see",
    "versus",
    "vs"
  ]);

/**
 * Inline code / quoted literal spans that often carry invented specifics.
 */
const QUOTED_LITERAL_PATTERN =
  /`([^`\n]{2,120})`|"([^"\n]{2,120})"|'([^'\n]{2,120})'/g;

/**
 * Generic English glue / discourse tokens allowed in paraphrases.
 * Not knowledge claims — keeps verification domain-agnostic.
 */
const DISCOURSE_TOKENS =
  new Set([
    "about", "above", "after", "again", "against", "allow", "allowed",
    "allowing", "allows", "almost", "along", "already", "also", "among",
    "another", "answer", "any", "around", "because", "before", "being",
    "below", "between", "both", "could", "describe", "described", "does",
    "during", "each", "either", "every", "express", "expressed", "expresses",
    "first", "from", "have", "having", "here", "into", "introduce",
    "introduced", "introduces", "introduction", "just", "know", "known",
    "later", "like", "made", "make", "makes", "many", "more", "most",
    "much", "must", "only", "other", "over", "propose", "proposed",
    "proposes", "provide", "provided", "provides", "question", "rather",
    "really", "result", "resulted", "results", "same", "should", "since",
    "some", "still", "such", "than", "that", "their", "them", "then",
    "there", "these", "they", "this", "those", "through", "under", "until",
    "using", "very", "want", "well", "were", "what", "when", "where",
    "which", "while", "with", "within", "without", "would", "author",
    "authored", "based", "called", "define", "defined", "defines",
    "improve", "improved", "improves", "improvement", "include", "includes",
    "including", "means", "meaning", "named", "related", "relate",
    "relates", "say", "says", "said", "show", "shows", "shown", "state",
    "states", "stated", "support", "supports", "supported", "therefore",
    "toward", "towards", "upon", "used", "uses", "whether", "whose",
    "according", "across", "address", "addresses", "addressed", "appear",
    "appears", "became", "become", "becomes", "before", "between",
    "common", "currently", "directly", "effectively", "generally",
    "however", "mainly", "mostly", "overall", "simply", "thereby",
    "expect", "expected", "expects", "python",
    "available", "evidence", "additional", "claims", "beyond",
    "grounded", "facts", "remaining", "portion", "insufficient",
    "importance", "broader", "information", "clearly", "entirely",
    "partial", "unsupported", "supported"
  ]);

/**
 * Whether a generated answer is grounded in the verified context.
 *
 * - Empty context ⇒ empty answer only
 * - Comparison context ⇒ exact comparison string
 * - Otherwise ⇒ references grounded labels/ids, invents no entity ids,
 *   and introduces no concrete factual fragments absent from the corpus
 */
export function isGeneratedAnswerGrounded(
  answer: string,
  context: ReasoningContext
): boolean {

  const trimmed =
    answer.trim();

  if (context.comparison !== undefined) {
    return answer === context.comparison;
  }

  if (context.evidence.length === 0) {
    return trimmed.length === 0;
  }

  if (trimmed.length === 0) {
    return false;
  }

  /*
   * Exact template / partial-evidence answers remain valid.
   */
  if (
    answer === templateGroundedAnswer(context) ||
    answer === buildPartialGroundedAnswer(context) ||
    answer === buildRelationshipNotEstablishedAnswer(context)
  ) {
    return true;
  }

  const allowedIds =
    new Set(
      context.items.map(item => item.entityId)
    );

  const mentionedIds =
    trimmed.match(ENTITY_ID_PATTERN) ?? [];

  for (const id of mentionedIds) {
    if (!allowedIds.has(id)) {
      return false;
    }
  }

  const corpus =
    buildGroundedCorpus(context);

  if (!concreteClaimsAreGrounded(trimmed, corpus)) {
    return false;
  }

  const lower =
    trimmed.toLowerCase();

  return context.items.some(item => {
    const label =
      item.label.trim().toLowerCase();

    const entityId =
      item.entityId.toLowerCase();

    return (
      (label.length > 0 &&
        lower.includes(label)) ||
      lower.includes(entityId)
    );
  });

}

/**
 * Fail closed when the answer introduces concrete fragments or content
 * tokens that are not attested by the grounded corpus.
 */
export function concreteClaimsAreGrounded(
  answer: string,
  corpus: string
): boolean {

  for (const claim of extractConcreteClaims(answer)) {
    if (!corpusAttests(corpus, claim)) {
      return false;
    }
  }

  return contentTokensAreGrounded(answer, corpus);

}

/**
 * Every non-discourse content token (length >= 5) must be attested by the
 * grounded corpus (substring or light stem). Prevents free-form factual
 * elaboration while still allowing paraphrasing verbs/glue words.
 */
export function contentTokensAreGrounded(
  answer: string,
  corpus: string
): boolean {

  for (const token of extractContentTokens(answer)) {

    if (DISCOURSE_TOKENS.has(token)) {
      continue;
    }

    if (tokenGroundedInCorpus(token, corpus)) {
      continue;
    }

    return false;

  }

  return true;

}

export function extractContentTokens(
  answer: string
): string[] {

  const normalized =
    answer
      .toLowerCase()
      .normalize("NFKD")
      // Drop punctuation; keep word characters. Hyphens become split points.
      .replace(/[^\p{L}\p{N}:_]+/gu, " ");

  const tokens: string[] = [];

  for (const raw of normalized.split(/\s+/)) {

    const token =
      raw.trim();

    if (token.length < 5) {
      continue;
    }

    // Entity ids handled separately.
    if (token.includes(":")) {
      continue;
    }

    tokens.push(token);

  }

  return tokens;

}

function tokenGroundedInCorpus(
  token: string,
  corpus: string
): boolean {

  if (corpus.includes(token)) {
    return true;
  }

  const variants =
    morphologicalVariants(token);

  for (const variant of variants) {
    if (
      variant.length >= 4 &&
      corpus.includes(variant)
    ) {
      return true;
    }
  }

  return false;

}

function morphologicalVariants(
  token: string
): string[] {

  const variants =
    new Set<string>([token]);

  if (token.endsWith("ies") && token.length > 4) {
    variants.add(`${token.slice(0, -3)}y`);
  }

  if (token.endsWith("ing") && token.length > 5) {
    variants.add(token.slice(0, -3));
    variants.add(`${token.slice(0, -3)}e`);
  }

  if (token.endsWith("ed") && token.length > 4) {
    variants.add(token.slice(0, -2));
    variants.add(`${token.slice(0, -1)}`);
  }

  if (token.endsWith("es") && token.length > 4) {
    variants.add(token.slice(0, -2));
    variants.add(token.slice(0, -1));
  } else if (token.endsWith("s") && token.length > 4) {
    variants.add(token.slice(0, -1));
  }

  return [...variants];

}

export function extractConcreteClaims(
  answer: string
): string[] {

  const claims: string[] = [];

  const parameterized =
    answer.match(PARAMETERIZED_FORM_PATTERN) ?? [];

  for (const match of parameterized) {
    claims.push(match);
  }

  const relationships =
    answer.match(RELATIONSHIP_TOKEN_PATTERN) ?? [];

  for (const match of relationships) {
    claims.push(match);
  }

  for (const match of answer.matchAll(ATTRIBUTE_CLAIM_PATTERN)) {

    const key =
      match[1]?.trim() ?? "";

    const value =
      match[2]?.trim() ?? "";

    if (
      key.length === 0 ||
      value.length === 0 ||
      ATTRIBUTE_KEY_BLOCKLIST.has(key.toLowerCase())
    ) {
      continue;
    }

    // Attest key and value independently so "Proposal: Type Hints" can pass
    // when both fragments appear in the grounded corpus.
    claims.push(key);
    claims.push(value);

  }

  for (const match of answer.matchAll(QUOTED_LITERAL_PATTERN)) {

    const literal =
      (match[1] ?? match[2] ?? match[3] ?? "").trim();

    if (literal.length < 3) {
      continue;
    }

    claims.push(literal);

  }

  return claims;

}
