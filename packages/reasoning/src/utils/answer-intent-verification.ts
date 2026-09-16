import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  understandQuery,
  type QueryIntentKind,
  type QueryUnderstanding
} from "./query-understanding.js";

import {
  evaluateLogicalImplication,
  evaluateClaimsAgainstEvidence,
  type ImplicationSupport,
  type LogicalClaim
} from "./logical-implication.js";

import {
  classifyRelationalSupport
} from "./classify-relational-support.js";

import {
  detectRelationshipBetweenQuery
} from "./detect-relationship-between-query.js";

import type {
  AnalyticalResult
} from "./execute-analytical.js";

import {
  detectSummarizationContradiction
} from "./execute-summarization.js";

/**
 * Structured claim-level answer semantics for verification (P3).
 */
export type AnswerSupportStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "NOT_SUPPORTED";

export interface StructuredAnswerClaim {
  subject?: string;
  predicate: string;
  object?: string;
  status: "SUPPORTED" | "NOT_SUPPORTED" | "MISSING";
}

export interface StructuredAnswerSemantics {
  intent: QueryIntentKind;
  status: AnswerSupportStatus;
  claims: StructuredAnswerClaim[];
  implicationSupport: ImplicationSupport;
  reasons: string[];
}

export interface AnswerIntentVerification {
  /**
   * Whether the generated prose adequately answers the requested intent.
   */
  matchesIntent: boolean;
  /**
   * Whether the answer is stronger than evidence allows.
   */
  exceedsEvidence: boolean;
  semantics: StructuredAnswerSemantics;
  /**
   * Concise trace lines for verification decisions.
   */
  traceLines: string[];
}

const FOCUS_ANSWER_CUES: Record<string, RegExp> = {
  PROPOSED_BY:
    /\b(?:proposed by|who proposed|author)\b/i,
  INTRODUCES:
    /\b(?:introduced|introduces|introduce)\b/i,
  ADDRESSES:
    /\b(?:addressed|addresses|address|concern|problem)\b/i,
  RESULTS_IN:
    /\b(?:resulted in|results in|decision|accepted|final)\b/i,
  IMPLEMENTED_IN:
    /\b(?:implemented in|python version|version)\b/i
};

function resolveUnderstanding(
  context: ReasoningContext
): QueryUnderstanding {

  return (
    context.understanding ??
    understandQuery(context.query ?? "")
  );

}

function answerBoundsUnsupported(
  answer: string
): boolean {

  return /does not establish|not established|insufficient evidence|no evidence establishes|analytical result:\s*(?:NOT_SUPPORTED|INSUFFICIENT_EVIDENCE)|summarization:\s*(?:NOT_SUPPORTED|INSUFFICIENT_EVIDENCE)/i
    .test(answer);

}

const COUNT_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

/**
 * Strip PEP identifiers before extracting numeric count candidates so
 * PEP-484 / proposal:PEP-526 / proposal\:PEP-604 are never treated as counts.
 */
function stripPepIdentifiers(
  answer: string
): string {

  return answer
    .replace(/\bproposal\\?:PEP[\s_-]?\d+\b/gi, " ")
    .replace(/\bPEP[\s_-]?\d+\b/gi, " ");

}

/**
 * PEP numbers present in the structured analytical entity sets.
 * Bare "(484)" list references must not be treated as analytical counts.
 */
function analyticalPepNumbers(
  analytical: AnalyticalResult
): Set<number> {

  const numbers =
    new Set<number>();

  const ids =
    [
      ...analytical.deduplicatedEntityIds,
      ...analytical.matchedEntities.map(item => item.entityId),
      ...(analytical.nonMatchingEntities ?? []).map(item => item.entityId),
      ...(analytical.universeEntityIds ?? [])
    ];

  for (const id of ids) {
    for (const match of id.matchAll(/PEP[\s_-]?(\d+)/gi)) {
      const value =
        Number(match[1]);

      if (Number.isFinite(value)) {
        numbers.add(value);
      }
    }
  }

  return numbers;

}

function stripAnalyticalPepNumbers(
  text: string,
  analytical: AnalyticalResult
): string {

  let cleaned =
    text;

  for (const value of analyticalPepNumbers(analytical)) {
    cleaned =
      cleaned.replace(
        new RegExp(`\\b${value}\\b`, "g"),
        " "
      );
  }

  return cleaned;

}

/**
 * Explicit count claims only ("there are 4", "4 PEPs", "count: 4", "four PEPs").
 * Ambient digits that merely identify PEPs are ignored.
 */
function extractExplicitCountClaims(
  answer: string,
  analytical: AnalyticalResult
): number[] {

  const cleaned =
    stripAnalyticalPepNumbers(
      stripPepIdentifiers(answer),
      analytical
    );

  const claims: number[] = [];

  const patterns =
    [
      /\b(?:count|total|number)\b[^.\n]{0,48}?\b(\d+)\b/gi,
      /\bthere (?:are|were)\s+(\d+)\b/gi,
      /\b(\d+)\s+peps?\b/gi,
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+peps?\b/gi
    ];

  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) {
      const raw =
        match[1];

      if (!raw) {
        continue;
      }

      const asWord =
        COUNT_WORDS[raw.toLowerCase()];

      const value =
        asWord !== undefined
          ? asWord
          : Number(raw);

      if (Number.isFinite(value)) {
        claims.push(value);
      }
    }
  }

  return claims;

}

/**
 * Legacy ambient count candidates. Matched-entity PEP numbers are removed so
 * list answers like "Type Hints (484), …" do not invent a false count.
 */
function extractCountCandidates(
  answer: string,
  analytical?: AnalyticalResult
): number[] {

  let cleaned =
    stripPepIdentifiers(answer);

  if (analytical) {
    cleaned =
      stripAnalyticalPepNumbers(cleaned, analytical);
  }

  const digits =
    [...cleaned.matchAll(/\b(\d+)\b/g)]
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value));

  for (const [word, value] of Object.entries(COUNT_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(cleaned)) {
      digits.push(value);
    }
  }

  return digits;

}

function canonicalizePepId(
  value: string
): string {

  const match =
    value.match(/PEP[\s_-]?(\d+)/i);

  if (match?.[1]) {
    return `pep-${match[1]}`;
  }

  return value.toLowerCase().replace(/[\s_\\:]+/g, "");

}

function extractMentionedPeps(
  answer: string,
  analytical?: AnalyticalResult
): string[] {

  const mentioned =
    new Set<string>();

  for (const match of answer.matchAll(/\bproposal\\?:PEP[\s_-]?(\d+)\b/gi)) {
    mentioned.add(`PEP-${match[1]}`);
  }

  for (const match of answer.matchAll(/\bPEP[\s_-]?(\d+)\b/gi)) {
    mentioned.add(`PEP-${match[1]}`);
  }

  if (analytical) {
    const withoutPrefixed =
      stripPepIdentifiers(answer);

    for (const value of analyticalPepNumbers(analytical)) {
      if (new RegExp(`\\b${value}\\b`).test(withoutPrefixed)) {
        mentioned.add(`PEP-${value}`);
      }
    }
  }

  return [...mentioned];

}

function analyticalEntityPepIds(
  analytical: AnalyticalResult,
  source: "matched" | "allowed"
): Set<string> {

  const ids =
    source === "matched"
      ? [
          ...analytical.deduplicatedEntityIds,
          ...analytical.matchedEntities.map(item => item.entityId)
        ]
      : [
          ...analytical.deduplicatedEntityIds,
          ...analytical.matchedEntities.map(item => item.entityId),
          ...(analytical.nonMatchingEntities ?? []).map(item => item.entityId),
          ...(analytical.universeEntityIds ?? [])
        ];

  return new Set(
    ids
      .map(canonicalizePepId)
      .filter(id => id.startsWith("pep-"))
  );

}

function pepAllowedByAnalytical(
  pep: string,
  analytical: AnalyticalResult
): boolean {

  const compactPep =
    canonicalizePepId(pep);

  return [...analyticalEntityPepIds(analytical, "allowed")]
    .some(id => id === compactPep || id.includes(compactPep));

}

function objectMatchesRequestedTarget(
  item: AnalyticalResult["matchedEntities"][number],
  objectPhrase: string
): boolean {

  const needle =
    objectPhrase.toLowerCase().replace(/[^\w]+/g, "");

  if (!needle) {
    return true;
  }

  const candidates =
    [
      item.objectLabel,
      item.objectEntityId,
      item.objectEntityId?.split(":").pop()
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => value.toLowerCase().replace(/[^\w]+/g, ""));

  return candidates.some(candidate =>
    candidate === needle ||
    candidate.endsWith(needle) ||
    needle.endsWith(candidate)
  );

}

function answerMentionsComplement(
  answer: string,
  analytical: AnalyticalResult
): boolean {

  if (
    /\bnon-matching\b|\buniverse\b|\bnon matching\b|\bcomplement\b/i
      .test(answer)
  ) {
    return true;
  }

  const nonMatching =
    analytical.nonMatchingEntities ?? [];

  if (nonMatching.length === 0) {
    /*
     * Empty complement may be expressed without the exact template words.
     */
    return (
      /\bnone\b/i.test(answer) ||
      /\bno peps?\b/i.test(answer) ||
      /\ball(?:\s+\w+)?\s+peps?\b/i.test(answer) ||
      /\bdo not\b|\bdon't\b|\bdoes not\b/i.test(answer) ||
      /\b\(none\)/i.test(answer)
    );
  }

  return (
    /\bdo not\b|\bdon't\b|\bdoes not\b|\bnon-matching\b/i.test(answer) &&
    nonMatching.some(item =>
      mentionsPhrase(answer, item.entityId) ||
      mentionsPhrase(answer, item.label) ||
      extractMentionedPeps(answer).some(pep =>
        item.entityId.toLowerCase().includes(pep.toLowerCase().replace("-", ""))
      )
    )
  );

}

/**
 * Detect when generated prose invents a count/list that conflicts with
 * the deterministic analytical result.
 */
function detectAnalyticalAnswerContradiction(
  answer: string,
  analytical: AnalyticalResult
): string | undefined {

  if (analytical.requestedTargetEstablished === false) {
    const claimsPositiveMatches =
      (
        extractMentionedPeps(answer).length > 0 &&
        !/zero matches|no matching|could not be established|without broadening/i
          .test(answer)
      ) ||
      /\bcount of distinct[^.\n]*:\s*[1-9]/i.test(answer);

    if (
      claimsPositiveMatches &&
      !answerBoundsUnsupported(answer) &&
      !/could not be established|refusing to broaden|no matching|zero matches/i.test(answer)
    ) {
      return (
        "Answer claims analytical matches but the requested target was not established"
      );
    }
  }

  const objectPhrase =
    analytical.filters?.objectPhrase;

  if (
    objectPhrase &&
    analytical.filters?.requireObjectMatch
  ) {
    for (const item of analytical.matchedEntities) {
      if (!item.objectLabel && !item.objectEntityId) {
        continue;
      }

      if (!objectMatchesRequestedTarget(item, objectPhrase)) {
        return (
          `Analytical matches include object "${item.objectLabel ?? item.objectEntityId}" ` +
          `which is not the requested target "${objectPhrase}"`
        );
      }
    }

    /*
     * Reject answers that attribute the wrong introduced feature when the
     * requested object is explicit and unmatched/wrong.
     */
    if (
      analytical.matchedEntities.length === 0 &&
      /\b(?:typing|type hints?)\b/i.test(answer) &&
      !/typing/i.test(objectPhrase) &&
      !answerBoundsUnsupported(answer) &&
      !/zero matches|could not be established|without broadening/i.test(answer)
    ) {
      return (
        `Answer discusses Typing but the analytical request targeted "${objectPhrase}"`
      );
    }
  }

  if (
    analytical.requestedOutputs?.includes("complement") ||
    Array.isArray(analytical.nonMatchingEntities)
  ) {
    if (
      !answerMentionsComplement(answer, analytical) &&
      analytical.status === "SUPPORTED" &&
      !answerBoundsUnsupported(answer)
    ) {
      return (
        "Answer omits the requested non-matching/complement analytical set"
      );
    }
  }

  if (
    analytical.operation === "COUNT" ||
    analytical.operation === "DISTINCT_COUNT"
  ) {
    const expected =
      typeof analytical.value === "number"
        ? analytical.value
        : undefined;

    if (expected !== undefined) {
      const explicitCounts =
        extractExplicitCountClaims(answer, analytical);

      /*
       * Prefer explicit count phrases. Fall back to ambient digits only after
       * stripping matched-entity PEP numbers so list IDs cannot invent counts.
       */
      const candidates =
        explicitCounts.length > 0
          ? explicitCounts
          : extractCountCandidates(answer, analytical);

      if (
        candidates.length > 0 &&
        !candidates.includes(expected)
      ) {
        return (
          `Answer count ${candidates.join(",")} contradicts analytical count ${expected}`
        );
      }
    }

    /*
     * Compound "how many … and which …": PEPs named in the answer must be
     * within the structured match/universe sets. Extra entities fail closed.
     */
    if (
      analytical.requestedOutputs?.includes("list") ||
      analytical.matchedEntities.length > 0
    ) {
      const mentioned =
        extractMentionedPeps(answer, analytical);

      for (const pep of mentioned) {
        if (!pepAllowedByAnalytical(pep, analytical)) {
          return (
            `Answer introduces ${pep} which is not in the analytical result set`
          );
        }
      }

      /*
       * When the answer restates the count and names PEPs, require the named
       * set to cover the structured matched entities (no silent omissions).
       */
      if (
        analytical.requestedOutputs?.includes("list") &&
        expected !== undefined &&
        (
          extractExplicitCountClaims(answer, analytical).includes(expected) ||
          extractCountCandidates(answer, analytical).includes(expected)
        ) &&
        mentioned.length > 0
      ) {
        const matchedPeps =
          analyticalEntityPepIds(analytical, "matched");

        const mentionedPeps =
          new Set(mentioned.map(canonicalizePepId));

        for (const pep of matchedPeps) {
          if (!mentionedPeps.has(pep)) {
            return (
              `Answer omits matched analytical entity ${pep.toUpperCase()}`
            );
          }
        }
      }
    }
  }

  if (
    analytical.operation === "MIN" ||
    analytical.operation === "MAX"
  ) {
    const expected =
      typeof analytical.value === "number"
        ? analytical.value
        : undefined;

    if (expected === undefined) {
      return undefined;
    }

    const mentioned =
      extractCountCandidates(answer, analytical);

    if (
      mentioned.length > 0 &&
      !mentioned.includes(expected)
    ) {
      return (
        `Answer numeric value contradicts analytical ${analytical.operation}=${expected}`
      );
    }
  }

  if (analytical.operation === "LIST") {
    for (const pep of extractMentionedPeps(answer, analytical)) {
      if (!pepAllowedByAnalytical(pep, analytical)) {
        return (
          `Answer introduces ${pep} which is not in the analytical result set`
        );
      }
    }
  }

  if (analytical.operation === "EXISTS") {
    const claimsYes =
      /\byes\b/i.test(answer);

    const claimsNo =
      /\bno\b/i.test(answer) ||
      /\bno matching\b/i.test(answer);

    if (
      analytical.status === "SUPPORTED_EXISTS" &&
      claimsNo &&
      !claimsYes
    ) {
      return "Answer denies existence but analytical result found matches";
    }

    if (
      analytical.status === "SUPPORTED_NOT_EXISTS" &&
      claimsYes &&
      !/not a claim about the entire/i.test(answer)
    ) {
      return "Answer claims existence but analytical result found no matches";
    }
  }

  return undefined;

}

function mentionsPhrase(
  answer: string,
  phrase: string | undefined
): boolean {

  if (!phrase?.trim()) {
    return false;
  }

  const lower =
    answer.toLowerCase();

  const target =
    phrase.trim().toLowerCase();

  if (lower.includes(target)) {
    return true;
  }

  const compactTarget =
    target.replace(/[\s_-]+/g, "");

  const compactAnswer =
    lower.replace(/[\s_-]+/g, "");

  return compactAnswer.includes(compactTarget);

}

function focusCoveredInAnswer(
  focus: string,
  answer: string,
  context: ReasoningContext
): boolean {

  const cue =
    FOCUS_ANSWER_CUES[focus];

  if (cue?.test(answer)) {
    return true;
  }

  if (focus === "PROPOSED_BY") {
    return context.items.some(item =>
      item.entityType === "Author" &&
      mentionsPhrase(answer, item.label)
    );
  }

  return false;

}

function buildCompoundClaims(
  understanding: QueryUnderstanding,
  answer: string,
  relationalEstablished: string[],
  context: ReasoningContext
): StructuredAnswerClaim[] {

  if (understanding.claims.length > 0) {
    const decision =
      evaluateClaimsAgainstEvidence(
        understanding.claims as LogicalClaim[],
        context
      );

    return decision.claims.map(evaluation => {
      const evidenceSupported =
        evaluation.support === "SUPPORTED";

      const answerHas =
        claimCoveredInAnswer(
          evaluation.claim,
          answer,
          context
        );

      if (evidenceSupported && answerHas) {
        return {
          subject: evaluation.claim.subject,
          predicate: evaluation.claim.predicate,
          object: evaluation.claim.object,
          status: "SUPPORTED" as const
        };
      }

      if (evidenceSupported && !answerHas) {
        return {
          subject: evaluation.claim.subject,
          predicate: evaluation.claim.predicate,
          object: evaluation.claim.object,
          status: "MISSING" as const
        };
      }

      return {
        subject: evaluation.claim.subject,
        predicate: evaluation.claim.predicate,
        object: evaluation.claim.object,
        status: "NOT_SUPPORTED" as const
      };
    });
  }

  const focuses =
    understanding.relationshipRequested.length > 0
      ? understanding.relationshipRequested
      : understanding.subRequests
          .map(item => item.focus)
          .filter((focus): focus is string => Boolean(focus));

  return focuses.map(focus => {
    const evidenceHas =
      relationalEstablished.includes(focus);

    const answerHas =
      focusCoveredInAnswer(focus, answer, context);

    if (evidenceHas && answerHas) {
      return {
        predicate: focus,
        status: "SUPPORTED" as const
      };
    }

    if (evidenceHas && !answerHas) {
      return {
        predicate: focus,
        status: "MISSING" as const
      };
    }

    return {
      predicate: focus,
      status: "NOT_SUPPORTED" as const
    };
  });

}

function claimCoveredInAnswer(
  claim: LogicalClaim,
  answer: string,
  context: ReasoningContext
): boolean {

  if (claim.inferenceMode === "causal_extra") {
    /*
     * Unsupported causal/chronology claims should only count as covered
     * when the answer explicitly bounds them as unsupported.
     */
    return answerBoundsUnsupported(answer);
  }

  if (
    claim.object &&
    mentionsPhrase(answer, claim.object)
  ) {
    return true;
  }

  if (focusCoveredInAnswer(claim.predicate, answer, context)) {
    /*
     * For open object requests, a focus cue / grounded endpoint mention
     * is enough. Still require subject when the answer names a different
     * PEP so spillover prose cannot cover the claim.
     */
    if (!claim.subject?.trim()) {
      return true;
    }

    if (mentionsPhrase(answer, claim.subject) || /\bit\b/i.test(answer)) {
      return true;
    }

    const foreignPep =
      answer.match(/\bPEP[\s_-]?(\d+)\b/gi) ?? [];

    const subjectPep =
      claim.subject.match(/\bPEP[\s_-]?(\d+)\b/i)?.[1];

    if (
      subjectPep &&
      foreignPep.some(match => {
        const digits =
          match.match(/(\d+)/)?.[1];
        return digits && digits !== subjectPep;
      })
    ) {
      return false;
    }

    /*
     * Author-only answers for PROPOSED_BY remain covered via focus cues.
     */
    return true;
  }

  return false;

}

/**
 * Deterministic check: does the generated answer address the user intent
 * without exceeding evidence strength?
 */
export function verifyAnswerAgainstIntent(
  answer: string,
  context: ReasoningContext
): AnswerIntentVerification {

  const understanding =
    resolveUnderstanding(context);

  const implication =
    evaluateLogicalImplication(
      context.query,
      context
    );

  const relational =
    classifyRelationalSupport(
      context.query,
      context
    );

  const reasons: string[] = [];
  const traceLines: string[] = [];
  const claims: StructuredAnswerClaim[] = [];

  let matchesIntent =
    true;

  let exceedsEvidence =
    false;

  let status: AnswerSupportStatus =
    "SUPPORTED";

  /*
   * P1 implication status is authoritative for IMPLICATION intents.
   */
  if (understanding.intent === "IMPLICATION") {

    for (const evaluation of implication.claims) {
      claims.push({
        subject: evaluation.claim.subject,
        predicate: evaluation.claim.predicate,
        object: evaluation.claim.object,
        status:
          evaluation.support === "SUPPORTED"
            ? "SUPPORTED"
            : "NOT_SUPPORTED"
      });
    }

    if (implication.support === "NOT_SUPPORTED") {
      status = "NOT_SUPPORTED";

      if (
        !answerBoundsUnsupported(answer) &&
        answer.trim().length > 0
      ) {
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(
          "Answer does not report that the requested conclusion is unsupported"
        );
        traceLines.push(
          "Verification: generated claim exceeded evidence"
        );
      }
    } else if (implication.support === "PARTIALLY_SUPPORTED") {
      status = "PARTIALLY_SUPPORTED";

      const hasSupportedFact =
        implication.claims.some(item => item.support === "SUPPORTED") &&
        (
          /\b(?:introduced|addresses|addressed|proposed)\b/i.test(answer) ||
          answerBoundsUnsupported(answer)
        );

      if (!answerBoundsUnsupported(answer)) {
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(
          "Partial implication answer must explicitly bound unsupported claims"
        );
        traceLines.push(
          "Verification: generated claim exceeded evidence"
        );
      } else if (!hasSupportedFact && implication.established.length > 0) {
        matchesIntent = false;
        reasons.push(
          "Partial implication answer omits supported evidence"
        );
        traceLines.push(
          "Verification: answer incomplete for requested intent"
        );
      }
    } else if (implication.support === "SUPPORTED") {
      status = "SUPPORTED";

      /*
       * True-but-weaker answers that ignore the conclusion ask are rejected.
       * Require either an explicit establish/support framing or ontology verbs
       * covering the supported claim predicates.
       */
      const coversSupportedClaim =
        implication.claims
          .filter(item => item.support === "SUPPORTED")
          .every(item => {
            if (
              item.claim.predicate === "INTRODUCES" ||
              item.claim.predicate === "ADDRESSES" ||
              item.claim.predicate === "PROPOSED_BY"
            ) {
              return focusCoveredInAnswer(
                item.claim.predicate,
                answer,
                context
              );
            }

            return true;
          });

      if (
        !coversSupportedClaim &&
        !/establish|supports the conclusion|supported/i.test(answer)
      ) {
        matchesIntent = false;
        reasons.push(
          "Answer is factually related but does not address the requested conclusion"
        );
        traceLines.push(
          "Verification: answer does not address requested intent"
        );
      }
    }

    const semantics: StructuredAnswerSemantics = {
      intent: understanding.intent,
      status,
      claims,
      implicationSupport: implication.support,
      reasons
    };

    if (matchesIntent && !exceedsEvidence) {
      traceLines.push(
        "Verification: answer matches intent and evidence bounds"
      );
    }

    return {
      matchesIntent,
      exceedsEvidence,
      semantics,
      traceLines
    };

  }

  /*
   * Exact typed-edge RELATIONSHIP asks: subject + predicate + object + direction.
   */
  if (
    understanding.intent === "RELATIONSHIP" &&
    understanding.claims.some(claim =>
      claim.inferenceMode === "typed_edge" &&
      Boolean(claim.subject?.trim()) &&
      Boolean(claim.object?.trim())
    )
  ) {

    const typedClaims =
      understanding.claims.filter(claim =>
        claim.inferenceMode === "typed_edge" &&
        Boolean(claim.subject?.trim()) &&
        Boolean(claim.object?.trim())
      ) as LogicalClaim[];

    const decision =
      evaluateClaimsAgainstEvidence(
        typedClaims,
        context
      );

    for (const evaluation of decision.claims) {
      claims.push({
        subject: evaluation.claim.subject,
        predicate: evaluation.claim.predicate,
        object: evaluation.claim.object,
        status:
          evaluation.support === "SUPPORTED"
            ? "SUPPORTED"
            : "NOT_SUPPORTED"
      });
    }

    if (decision.support === "SUPPORTED") {
      status = "SUPPORTED";
    } else if (decision.support === "PARTIALLY_SUPPORTED") {
      status = "PARTIALLY_SUPPORTED";
      matchesIntent = false;
      reasons.push(
        "Only part of the requested relationship claim is established"
      );
      traceLines.push(
        "Verification: typed relationship claim partially supported"
      );
    } else {
      status = "NOT_SUPPORTED";

      if (
        !answerBoundsUnsupported(answer) &&
        answer.trim().length > 0
      ) {
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(
          "Answer asserts a typed relationship that is not established"
        );
        traceLines.push(
          "Verification: typed relationship claim not supported"
        );
      }
    }

  }

  /*
   * Direct relationship: shared-hub connectivity language is a mismatch.
   */
  if (understanding.intent === "DIRECT_RELATIONSHIP") {

    const claimsDirect =
      /\bdirectly\s+(?:related|connected|linked)\b/i.test(answer);

    const claimsHubOnly =
      /\b(?:connected through|both (?:related|connected)|related via|via\s+PEP)\b/i
        .test(answer);

    if (
      relational.kind === "relationship_missing" ||
      relational.kind === "partial"
    ) {
      status = "NOT_SUPPORTED";
      claims.push({
        predicate: "DIRECT",
        status: "NOT_SUPPORTED"
      });

      if (
        (claimsDirect || claimsHubOnly) &&
        !answerBoundsUnsupported(answer)
      ) {
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(
          "Answer asserts a direct/connected relationship that is not established"
        );
        traceLines.push(
          "Verification: direct relationship mismatch"
        );
      }
    } else {
      status = "SUPPORTED";
      claims.push({
        predicate: "DIRECT",
        status: "SUPPORTED"
      });
    }

  }

  /*
   * Bridge / connected: both endpoints (and bridge when requested) must appear,
   * unless the answer explicitly fails closed.
   */
  if (
    understanding.intent === "BRIDGE_RELATIONSHIP" ||
    understanding.intent === "CONNECTED_RELATIONSHIP"
  ) {

    const between =
      detectRelationshipBetweenQuery(context.query ?? "");

    const left =
      between?.left ??
      understanding.requireRelationshipBetween?.left ??
      understanding.entities.find(entity =>
        !/^PEP-\d+$/i.test(entity)
      ) ??
      understanding.entities[0];

    const right =
      between?.right ??
      understanding.requireRelationshipBetween?.right ??
      understanding.entities.filter(entity =>
        entity !== left && !/^PEP-\d+$/i.test(entity)
      )[0] ??
      understanding.entities[1];

    const bridge =
      between?.bridge ??
      understanding.bridgeEntity;

    const pathOk =
      relational.kind === "full";

    if (pathOk) {
      status = "SUPPORTED";

      const leftOk =
        !left || mentionsPhrase(answer, left);

      const rightOk =
        !right || mentionsPhrase(answer, right);

      const bridgeMentioned =
        !bridge ||
        mentionsPhrase(answer, bridge) ||
        context.items.some(item =>
          mentionsPhrase(answer, item.label) &&
          (
            mentionsPhrase(item.label, bridge) ||
            mentionsPhrase(item.entityId, bridge) ||
            String(item.properties?.pep ?? "") ===
              bridge.replace(/^PEP-/i, "")
          )
        );

      const bridgeOk =
        understanding.intent !== "BRIDGE_RELATIONSHIP" ||
        bridgeMentioned ||
        /\bthrough\b|\bvia\b|\bconnected\b/i.test(answer) ||
        (
          leftOk &&
          rightOk &&
          /\b(?:introduced|addresses|addressed|proposed)\b/i.test(answer)
        );

      if (answerBoundsUnsupported(answer)) {
        matchesIntent = true;
      } else if (!leftOk || !rightOk || !bridgeOk) {
        matchesIntent = false;
        status = "PARTIALLY_SUPPORTED";
        reasons.push(
          "Answer does not cover the requested connected/bridge relationship"
        );
        traceLines.push(
          "Verification: answer incomplete for requested relationship"
        );
      }

      claims.push({
        subject: left,
        predicate:
          understanding.intent === "BRIDGE_RELATIONSHIP"
            ? "BRIDGE"
            : "CONNECTED",
        object: right,
        status:
          matchesIntent
            ? "SUPPORTED"
            : "MISSING"
      });
    } else {
      status = "NOT_SUPPORTED";
      claims.push({
        predicate:
          understanding.intent === "BRIDGE_RELATIONSHIP"
            ? "BRIDGE"
            : "CONNECTED",
        status: "NOT_SUPPORTED"
      });

      if (
        !answerBoundsUnsupported(answer) &&
        answer.trim().length > 0 &&
        /\b(?:connected|bridge|related|through|via)\b/i.test(answer)
      ) {
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(
          "Answer asserts connected/bridge topology that is not established"
        );
        traceLines.push(
          "Verification: connected/bridge path not established"
        );
      }
    }

  }

  /*
   * P6 analytical: generated prose cannot override deterministic results.
   */
  if (understanding.intent === "ANALYTICAL") {

    const analytical =
      context.analyticalResult;

    const objectPhrase =
      analytical?.filters?.objectPhrase ??
      understanding.analytical?.filter?.objectPhrase;

    const relationshipType =
      analytical?.filters?.relationshipType ??
      understanding.analytical?.filter?.relationshipType;

    if (relationshipType) {
      claims.push({
        predicate: relationshipType,
        object: objectPhrase,
        status:
          analytical?.requestedTargetEstablished === false
            ? "NOT_SUPPORTED"
            : !analytical ||
                analytical.status === "NOT_SUPPORTED" ||
                analytical.status === "INSUFFICIENT_EVIDENCE"
              ? "NOT_SUPPORTED"
              : "SUPPORTED"
      });
    }

    if (
      analytical?.requestedOutputs?.includes("complement") ||
      understanding.analytical?.includeComplement
    ) {
      const complementAnswered =
        Array.isArray(analytical?.nonMatchingEntities) &&
        answerMentionsComplement(answer, analytical);

      claims.push({
        predicate: "COMPLEMENT",
        status:
          analytical?.status === "INSUFFICIENT_EVIDENCE" ||
          analytical?.status === "NOT_SUPPORTED"
            ? "NOT_SUPPORTED"
            : complementAnswered
              ? "SUPPORTED"
              : "MISSING"
      });
    }

    claims.push({
      predicate: analytical?.operation ?? "ANALYTICAL",
      status:
        !analytical ||
        analytical.status === "NOT_SUPPORTED" ||
        analytical.status === "INSUFFICIENT_EVIDENCE"
          ? "NOT_SUPPORTED"
          : "SUPPORTED"
    });

    if (
      !analytical ||
      analytical.status === "NOT_SUPPORTED" ||
      analytical.status === "INSUFFICIENT_EVIDENCE"
    ) {
      status = "NOT_SUPPORTED";

      if (
        !answerBoundsUnsupported(answer) &&
        answer.trim().length > 0 &&
        !/analytical result:\s*(?:NOT_SUPPORTED|INSUFFICIENT_EVIDENCE)/i
          .test(answer)
      ) {
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(
          "Analytical operation is unsupported or insufficient; answer must not invent a calculated result"
        );
        traceLines.push(
          "Verification: analytical result insufficient/not supported"
        );
      }
    } else {
      const contradiction =
        detectAnalyticalAnswerContradiction(answer, analytical);

      if (contradiction) {
        const complementOnlyGap =
          /omits the requested non-matching\/complement/i.test(contradiction);

        status = complementOnlyGap
          ? "PARTIALLY_SUPPORTED"
          : "NOT_SUPPORTED";
        matchesIntent = false;
        exceedsEvidence = !complementOnlyGap;
        reasons.push(contradiction);
        traceLines.push(
          complementOnlyGap
            ? "Verification: analytical complement incomplete"
            : "Verification: generated answer contradicted analytical result"
        );
      } else {
        status = "SUPPORTED";
        matchesIntent = true;
        traceLines.push(
          `Verification: analytical ${analytical.operation}=${String(analytical.value)}` +
          (objectPhrase ? ` object=${objectPhrase}` : "") +
          " consistent with answer"
        );
      }
    }

  }

  /*
   * P7 summarization: generated prose cannot override grounded synthesis.
   */
  if (understanding.intent === "SUMMARIZATION") {

    const summarization =
      context.summarizationResult;

    claims.push({
      predicate: "SUMMARIZATION",
      status:
        !summarization ||
        summarization.status === "NOT_SUPPORTED" ||
        summarization.status === "INSUFFICIENT_EVIDENCE"
          ? "NOT_SUPPORTED"
          : summarization.status === "PARTIALLY_SUPPORTED"
            ? "MISSING"
            : "SUPPORTED"
    });

    if (
      !summarization ||
      summarization.status === "NOT_SUPPORTED" ||
      summarization.status === "INSUFFICIENT_EVIDENCE"
    ) {
      status = "NOT_SUPPORTED";

      if (
        !answerBoundsUnsupported(answer) &&
        answer.trim().length > 0 &&
        !/summarization:\s*(?:NOT_SUPPORTED|INSUFFICIENT_EVIDENCE)/i
          .test(answer)
      ) {
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(
          "Summarization is unsupported or insufficient; answer must not invent a corpus summary"
        );
        traceLines.push(
          "Verification: summarization result insufficient/not supported"
        );
      }
    } else {
      const contradiction =
        detectSummarizationContradiction(answer, summarization);

      if (contradiction) {
        status = "NOT_SUPPORTED";
        matchesIntent = false;
        exceedsEvidence = true;
        reasons.push(contradiction);
        traceLines.push(
          "Verification: generated answer contradicted summarization synthesis"
        );
      } else if (summarization.status === "PARTIALLY_SUPPORTED") {
        status = "PARTIALLY_SUPPORTED";
        matchesIntent = true;
        reasons.push(
          "Cross-document synthesis was only partially available from grounded evidence"
        );
        traceLines.push(
          "Verification: summarization PARTIALLY_SUPPORTED"
        );
      } else {
        status = "SUPPORTED";
        matchesIntent = true;
        traceLines.push(
          `Verification: summarization mode=${summarization.mode} documents=${summarization.documentCount}`
        );
      }
    }

  }

  /*
   * Compound: clause-by-clause coverage of requested relationship focuses.
   */
  if (understanding.intent === "COMPOUND") {

    const compoundClaims =
      buildCompoundClaims(
        understanding,
        answer,
        relational.established,
        context
      );

    claims.push(...compoundClaims);

    const supportedCount =
      compoundClaims.filter(item => item.status === "SUPPORTED").length;

    const missingCount =
      compoundClaims.filter(item => item.status === "MISSING").length;

    const unsupportedCount =
      compoundClaims.filter(item => item.status === "NOT_SUPPORTED").length;

    if (
      compoundClaims.length > 0 &&
      supportedCount === compoundClaims.length
    ) {
      status = "SUPPORTED";
    } else if (supportedCount > 0) {
      status = "PARTIALLY_SUPPORTED";
      matchesIntent = false;
      reasons.push(
        "Compound answer covers only part of the requested clauses"
      );
      traceLines.push(
        "Verification: compound answer incomplete"
      );
    } else if (compoundClaims.length > 0) {
      status = "NOT_SUPPORTED";
      matchesIntent = false;
      reasons.push(
        "Compound answer does not establish any requested clause"
      );
      traceLines.push(
        "Verification: compound answer incomplete"
      );
    }

    if (
      missingCount > 0 &&
      unsupportedCount === 0 &&
      supportedCount > 0
    ) {
      status = "PARTIALLY_SUPPORTED";
    }

  }

  /*
   * Stronger-than-evidence causal language in the answer body.
   */
  if (
    /\b(?:because|therefore|thus|hence|so that|in order to|to improve|caused|led to)\b/i
      .test(answer) &&
    !answerBoundsUnsupported(answer)
  ) {
    const hasRelationalEvidence =
      context.evidence.some(item => item.relationship) ||
      context.items.some(item => item.relationship);

    if (!hasRelationalEvidence) {
      exceedsEvidence = true;
      matchesIntent = false;
      status = "NOT_SUPPORTED";
      reasons.push(
        "Answer uses causal language without relationship evidence"
      );
      traceLines.push(
        "Verification: generated claim exceeded evidence"
      );
    } else if (
      /\bto improve\b|\bbecause\b/i.test(answer) &&
      understanding.intent !== "FACT"
    ) {
      /*
       * Conservatively treat unexplained causal extras as exceeding evidence
       * unless the answer already bounds them.
       */
      const corpusHasImprove =
        context.evidence.some(item =>
          JSON.stringify(item).toLowerCase().includes("improve")
        );

      if (!corpusHasImprove) {
        exceedsEvidence = true;
        matchesIntent = false;
        if (status === "SUPPORTED") {
          status = "PARTIALLY_SUPPORTED";
        }
        reasons.push(
          "Answer includes causal explanation stronger than evidence"
        );
        traceLines.push(
          "Verification: generated claim exceeded evidence"
        );
      }
    }
  }

  if (
    matchesIntent &&
    !exceedsEvidence &&
    traceLines.length === 0
  ) {
    traceLines.push(
      "Verification: answer matches intent and evidence bounds"
    );
  }

  return {
    matchesIntent,
    exceedsEvidence,
    semantics: {
      intent: understanding.intent,
      status,
      claims,
      implicationSupport: implication.support,
      reasons
    },
    traceLines
  };

}

/**
 * Format a verification status line for the reasoning trace.
 */
export function formatVerificationTraceStep(
  verification: AnswerIntentVerification
): string {

  const status =
    verification.semantics.status;

  if (verification.exceedsEvidence) {
    return `Verification: ${status} — generated claim exceeded evidence`;
  }

  if (!verification.matchesIntent) {
    return `Verification: ${status} — answer does not fully address requested intent`;
  }

  return `Verification: ${status} — answer matches intent and evidence`;

}
