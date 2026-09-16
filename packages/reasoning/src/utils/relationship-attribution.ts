import type {
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import {
  entityMatchesPhrase
} from "./detect-relationship-between-query.js";

import {
  understandQuery
} from "./query-understanding.js";

/**
 * Natural-language verbs tied to attested relationship types.
 * Used only to verify that answer attribution matches edge direction.
 *
 * Subject/object phrases are limited to short noun phrases and stop before
 * a following attribution clause ("… and addressed …") so compound sentences
 * do not bleed into a single S-P-O capture.
 */
const NOUN_PHRASE =
  String.raw`[A-Za-z][A-Za-z0-9_-]*(?:\s+(?!and\b)[A-Za-z][A-Za-z0-9_-]*){0,5}`;

const CLAUSE_STOP =
  String.raw`(?=\s+and\s+(?:introduced|introduces|addresses|addressed|was proposed|proposed by|resulted|implemented)|[.,;]|$)`;

const ATTRIBUTION_CHECKS: Array<{
  type: string;
  pattern: RegExp;
}> = [
  {
    type: "ADDRESSES",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s+address(?:es|ed)\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "INTRODUCES",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s+(?:introduces|introduced|introduce)\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "PROPOSED_BY",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s+was proposed by\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "RESULTS_IN",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s+resulted in\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "IMPLEMENTED_IN",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s+was implemented in\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  }
];

/**
 * Coordinated elided-subject clauses: "X introduced Y and addressed Z".
 */
const ELIDED_CHECKS: Array<{
  type: string;
  pattern: RegExp;
}> = [
  {
    type: "ADDRESSES",
    pattern:
      new RegExp(
        String.raw`\band\s+address(?:es|ed)\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "INTRODUCES",
    pattern:
      new RegExp(
        String.raw`\band\s+(?:introduces|introduced|introduce)\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "PROPOSED_BY",
    pattern:
      new RegExp(
        String.raw`\band\s+was proposed by\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "RESULTS_IN",
    pattern:
      new RegExp(
        String.raw`\band\s+resulted in\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "IMPLEMENTED_IN",
    pattern:
      new RegExp(
        String.raw`\band\s+was implemented in\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  }
];

const STOP_SUBJECT =
  /^(?:and|or|but|the|a|an|it|this|that|they|he|she)$/i;

/**
 * Reject answers that linguistically attribute a relationship to the
 * wrong endpoint (e.g. "Typing addressed Readability" when the edge is
 * Proposal --ADDRESSES--> Readability).
 *
 * For COMPOUND / CLAIM_SET answers, each asserted S-P-O is checked against
 * its own bound relationship evidence — not as one graph path.
 *
 * Subject verbalizations may use entity labels or property aliases
 * (e.g. title "Type Hints" for subject PEP-484) when they resolve to the
 * same endpoint entity that owns the attested edge.
 */
export function relationshipAttributionIsGrounded(
  answer: string,
  context: ReasoningContext
): boolean {

  const relationships =
    collectRelationships(context);

  if (relationships.length === 0) {
    return true;
  }

  const catalog =
    buildEntityCatalog(context);

  const subjectPhrases =
    collectRequestedSubjectPhrases(context);

  const assertions =
    collectAttributionAssertions(answer);

  for (const assertion of assertions) {
    const grounded =
      relationships.some(relationship => {
        if (relationship.type !== assertion.type) {
          return false;
        }

        return (
          endpointPhraseMatches(
            assertion.source,
            relationship.from,
            catalog,
            subjectPhrases
          ) &&
          endpointPhraseMatches(
            assertion.target,
            relationship.to,
            catalog,
            subjectPhrases
          )
        );
      });

    if (!grounded) {
      return false;
    }
  }

  return true;

}

type AttributionAssertion = {
  type: string;
  source: string;
  target: string;
  index: number;
};

function collectAttributionAssertions(
  answer: string
): AttributionAssertion[] {

  const raw: Array<AttributionAssertion & { elided?: boolean }> = [];

  for (const check of ATTRIBUTION_CHECKS) {
    check.pattern.lastIndex = 0;

    for (const match of answer.matchAll(check.pattern)) {
      const source =
        (match[1] ?? "").trim();
      const target =
        (match[2] ?? "").trim();

      if (
        !source ||
        !target ||
        STOP_SUBJECT.test(source)
      ) {
        continue;
      }

      raw.push({
        type: check.type,
        source,
        target,
        index: match.index ?? 0
      });
    }
  }

  for (const check of ELIDED_CHECKS) {
    check.pattern.lastIndex = 0;

    for (const match of answer.matchAll(check.pattern)) {
      const target =
        (match[1] ?? "").trim();

      if (!target) {
        continue;
      }

      raw.push({
        type: check.type,
        source: "",
        target,
        index: match.index ?? 0,
        elided: true
      });
    }
  }

  raw.sort((left, right) => left.index - right.index);

  const resolved: AttributionAssertion[] = [];
  let lastSubject: string | undefined;

  for (const item of raw) {
    const source =
      item.elided
        ? lastSubject
        : item.source;

    if (!source || !item.target) {
      continue;
    }

    lastSubject = source;
    resolved.push({
      type: item.type,
      source,
      target: item.target,
      index: item.index
    });
  }

  return resolved;

}

function collectRelationships(
  context: ReasoningContext
): KnowledgeRelationship[] {

  const seen =
    new Set<string>();

  const rows: KnowledgeRelationship[] = [];

  for (const item of [
    ...context.items,
    ...context.evidence.map(entry => ({
      relationship: entry.relationship
    }))
  ]) {

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    const key =
      `${relationship.from}|${relationship.type}|${relationship.to}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push(relationship);

  }

  return rows;

}

function buildEntityCatalog(
  context: ReasoningContext
): Map<string, AttributionEntity> {

  const catalog =
    new Map<string, AttributionEntity>();

  function upsert(
    entity: AttributionEntity
  ): void {

    const existing =
      catalog.get(entity.id);

    if (!existing) {
      catalog.set(entity.id, entity);
      return;
    }

    catalog.set(entity.id, {
      id: entity.id,
      label: preferLabel(existing.label, entity.label),
      source: existing.source || entity.source,
      properties: {
        ...(existing.properties ?? {}),
        ...(entity.properties ?? {})
      }
    });

  }

  for (const item of context.items) {
    upsert({
      id: item.entityId,
      label: item.label,
      source: item.source,
      properties: item.properties
    });
  }

  for (const item of context.evidence) {
    upsert({
      id: item.entity.id,
      label: item.entity.label,
      source: item.entity.source,
      properties: item.entity.properties
    });
  }

  for (const relationship of collectRelationships(context)) {
    if (!catalog.has(relationship.from)) {
      catalog.set(
        relationship.from,
        synthesizeEndpoint(relationship.from)
      );
    }

    if (!catalog.has(relationship.to)) {
      catalog.set(
        relationship.to,
        synthesizeEndpoint(relationship.to)
      );
    }
  }

  return catalog;

}

function synthesizeEndpoint(
  id: string
): AttributionEntity {

  const tail =
    id.includes(":")
      ? id.slice(id.indexOf(":") + 1)
      : id;

  const pep =
    tail.match(/^PEP[\s_-]?(\d+)$/i)?.[1];

  return {
    id,
    label: tail,
    source: "",
    properties: pep
      ? { pep }
      : {}
  };

}

function preferLabel(
  current: string,
  next: string
): string {

  if (!current || current === next) {
    return next || current;
  }

  /*
   * Prefer human labels over raw ids when merging catalog rows.
   */
  if (current.includes(":") && !next.includes(":")) {
    return next;
  }

  return current;

}

function collectRequestedSubjectPhrases(
  context: ReasoningContext
): string[] {

  const understanding =
    context.understanding ??
    (context.query
      ? understandQuery(context.query)
      : undefined);

  const phrases =
    new Set<string>();

  for (const subject of understanding?.entities ?? []) {
    phrases.add(subject);
  }

  for (const claim of understanding?.claims ?? []) {
    if (claim.subject?.trim()) {
      phrases.add(claim.subject.trim());
    }
  }

  const between =
    understanding?.requireRelationshipBetween;

  if (between?.left) {
    phrases.add(between.left);
  }

  if (between?.right) {
    phrases.add(between.right);
  }

  if (understanding?.requireTypedEdge?.subject) {
    phrases.add(understanding.requireTypedEdge.subject);
  }

  return [...phrases];

}

function endpointPhraseMatches(
  phrase: string,
  endpointId: string,
  catalog: Map<string, AttributionEntity>,
  subjectPhrases: string[]
): boolean {

  const entity =
    catalog.get(endpointId) ??
    synthesizeEndpoint(endpointId);

  if (entityMatchesPhrase(entity, phrase)) {
    return true;
  }

  /*
   * Compound verbalization: answer uses an alternate label/alias for the
   * requested subject that owns this endpoint (e.g. "Type Hints" for PEP-484).
   */
  for (const subject of subjectPhrases) {
    if (!entityMatchesPhrase(entity, subject)) {
      continue;
    }

    if (phrasesAlign(phrase, subject)) {
      return true;
    }

    for (const candidate of catalog.values()) {
      if (
        entityMatchesPhrase(candidate, subject) &&
        entityMatchesPhrase(candidate, phrase)
      ) {
        return true;
      }
    }
  }

  return false;

}

function phrasesAlign(
  left: string,
  right: string
): boolean {

  const a =
    compact(left);

  const b =
    compact(right);

  return a.length > 0 && b.length > 0 && a === b;

}

function compact(
  value: string
): string {

  return value
    .toLowerCase()
    .replace(/[^\w]/g, "");

}

type AttributionEntity = {
  id: string;
  label: string;
  source: string;
  properties?: Record<string, unknown>;
};
