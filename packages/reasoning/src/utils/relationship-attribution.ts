import type {
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import {
  entityMatchesPhrase,
  normalizeEntityPhrase
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
  String.raw`[A-Za-z][A-Za-z0-9_-]*(?:\s+(?!and\b|was\b|by\b|introduced\b|introduces\b|introduce\b|addressed\b|addresses\b|proposed\b|resulted\b|implemented\b)[A-Za-z][A-Za-z0-9_-]*){0,5}`;

const CLAUSE_STOP =
  String.raw`(?=\s+and\s+(?:introduced|introduces|addresses|addressed|was proposed|proposed by|resulted|implemented|was introduced by)|[.,;]|$)`;

const ATTRIBUTION_CHECKS: Array<{
  type: string;
  pattern: RegExp;
  /**
   * When true, regex groups are [patient, agent] and map to edge to/from
   * for INTRODUCES-style passives ("Typing was introduced by X").
   */
  passive?: boolean;
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
        String.raw`\b(${NOUN_PHRASE})\s+(?:introduces|(?<!was\s)introduced|introduce)\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
        "gi"
      )
  },
  {
    type: "INTRODUCES",
    passive: true,
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s+was introduced by\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
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
  },
  {
    type: "INTRODUCES",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s*->\s*INTRODUCES\s*->\s*(${NOUN_PHRASE})`,
        "gi"
      )
  },
  {
    type: "ADDRESSES",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s*->\s*ADDRESSES\s*->\s*(${NOUN_PHRASE})`,
        "gi"
      )
  },
  {
    type: "PROPOSED_BY",
    pattern:
      new RegExp(
        String.raw`\b(${NOUN_PHRASE})\s*->\s*PROPOSED_BY\s*->\s*(${NOUN_PHRASE})`,
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
  /^(?:and|or|but|the|a|an|it|this|that|they|he|she|was|by|been)$/i;

const RELATIONSHIP_CUE =
  /\b(?:introduced|introduces|introduce|addressed|addresses|was proposed by|proposed by|resulted in|results in|implemented in|was introduced by|->\s*(?:INTRODUCES|ADDRESSES|PROPOSED_BY|RESULTS_IN|IMPLEMENTED_IN)\s*->)/i;

/**
 * Reject answers that linguistically attribute a relationship to the
 * wrong endpoint (e.g. "Typing addressed Readability" when the edge is
 * Proposal --ADDRESSES--> Readability).
 *
 * Validation is against bound ClaimEvidence / scoped answerEvidence
 * relationships — not a rediscovery over an unbound graph.
 *
 * Subject/object verbalizations may use entity labels or property aliases
 * when they resolve to the same bound endpoint.
 */
export function relationshipAttributionIsGrounded(
  answer: string,
  context: ReasoningContext
): boolean {

  const relationships =
    collectBoundRelationships(context);

  if (relationships.length === 0) {
    return true;
  }

  const catalog =
    buildEntityCatalog(context);

  const subjectPhrases =
    collectRequestedSubjectPhrases(context);

  const assertions =
    collectAttributionAssertions(answer);

  if (assertions.length === 0) {
    /*
     * Typed relationship asks must not vacuous-pass on object-only answers
     * such as "Typing" when bound INTRODUCES evidence exists.
     */
    if (!requiresTypedRelationshipAssertion(context)) {
      return true;
    }

    if (!RELATIONSHIP_CUE.test(answer)) {
      return false;
    }

    /*
     * Terse / arrow forms that name both endpoints of every bound edge.
     */
    return relationships.every(relationship =>
      answerMentionsEndpoint(
        answer,
        relationship.from,
        catalog,
        subjectPhrases
      ) &&
      answerMentionsEndpoint(
        answer,
        relationship.to,
        catalog,
        subjectPhrases
      )
    );
  }

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
      const first =
        (match[1] ?? "").trim();
      const second =
        (match[2] ?? "").trim();

      const source =
        check.passive ? second : first;
      const target =
        check.passive ? first : second;

      if (
        !source ||
        !target ||
        STOP_SUBJECT.test(source)
      ) {
        continue;
      }

      raw.push({
        type: check.type,
        source: normalizeEntityPhrase(source) || source,
        target: normalizeEntityPhrase(target) || target,
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
        target: normalizeEntityPhrase(target) || target,
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

/**
 * Prefer relationships bound on ClaimEvidence; fall back to scoped
 * answerEvidence / items (already query-focused — not full-graph search).
 */
function collectBoundRelationships(
  context: ReasoningContext
): KnowledgeRelationship[] {

  const seen =
    new Set<string>();

  const rows: KnowledgeRelationship[] = [];

  function push(
    relationship: KnowledgeRelationship | undefined
  ): void {

    if (!relationship) {
      return;
    }

    const key =
      `${relationship.from}|${relationship.type}|${relationship.to}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    rows.push(relationship);

  }

  for (const claim of context.answerContext?.claimEvidence ?? []) {
    for (const item of claim.evidence) {
      if (
        item.relationship &&
        item.relationship.type === claim.predicate
      ) {
        push(item.relationship);
      }
    }
  }

  if (rows.length > 0) {
    return rows;
  }

  for (const item of [
    ...context.items,
    ...context.evidence.map(entry => ({
      relationship: entry.relationship
    })),
    ...(context.answerContext?.answerEvidence ?? []).map(entry => ({
      relationship: entry.relationship
    }))
  ]) {
    push(item.relationship);
  }

  return rows;

}

function requiresTypedRelationshipAssertion(
  context: ReasoningContext
): boolean {

  const understanding =
    context.understanding ??
    (context.query
      ? understandQuery(context.query)
      : undefined);

  if (!understanding) {
    return false;
  }

  if (understanding.requireTypedEdge) {
    return true;
  }

  if (
    understanding.intent === "RELATIONSHIP" ||
    understanding.intent === "DIRECT_RELATIONSHIP" ||
    understanding.intent === "CONNECTED_RELATIONSHIP" ||
    understanding.intent === "BRIDGE_RELATIONSHIP" ||
    understanding.intent === "COMPOUND"
  ) {
    return true;
  }

  const predicates =
    context.answerContext?.requestedPredicates ??
    understanding.focusRelationships ??
    [];

  return predicates.length > 0;

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

  for (const item of [
    ...context.evidence,
    ...(context.answerContext?.answerEvidence ?? [])
  ]) {
    upsert({
      id: item.entity.id,
      label: item.entity.label,
      source: item.entity.source,
      properties: item.entity.properties
    });
  }

  for (const claim of context.answerContext?.claimEvidence ?? []) {
    for (const item of claim.evidence) {
      upsert({
        id: item.entity.id,
        label: item.entity.label,
        source: item.entity.source,
        properties: item.entity.properties
      });

      if (item.relationship) {
        if (!catalog.has(item.relationship.from)) {
          const synthesized =
            synthesizeEndpoint(item.relationship.from);

          upsert({
            ...synthesized,
            /*
             * Prefer the claim's subject phrase as the display label for a
             * missing from-endpoint — never attach object phrases onto from.
             */
            label:
              claim.subject?.trim() ||
              synthesized.label
          });
        }

        if (!catalog.has(item.relationship.to)) {
          const synthesized =
            synthesizeEndpoint(item.relationship.to);

          upsert({
            ...synthesized,
            label:
              (
                claim.object &&
                isCleanClaimObject(claim.object)
              )
                ? claim.object.trim()
                : synthesized.label
          });
        }
      }
    }
  }

  for (const relationship of collectBoundRelationships(context)) {
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

function isCleanClaimObject(
  value: string
): boolean {

  const trimmed =
    value.trim();

  if (!trimmed) {
    return false;
  }

  if (
    /\band\b/i.test(trimmed) &&
    /\b(?:introduc|address|propos|result|implement)\w*/i.test(trimmed)
  ) {
    return false;
  }

  return true;

}

function preferLabel(
  current: string,
  next: string
): string {

  if (!current || current === next) {
    return next || current;
  }

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

  for (const subject of context.answerContext?.requestedSubjects ?? []) {
    phrases.add(subject);
  }

  for (const claim of understanding?.claims ?? []) {
    if (claim.subject?.trim()) {
      phrases.add(claim.subject.trim());
    }
  }

  for (const claim of context.answerContext?.claimEvidence ?? []) {
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

  const normalized =
    normalizeEntityPhrase(phrase) || phrase;

  const entity =
    catalog.get(endpointId) ??
    synthesizeEndpoint(endpointId);

  if (
    entityMatchesPhrase(entity, phrase) ||
    entityMatchesPhrase(entity, normalized)
  ) {
    return true;
  }

  for (const subject of subjectPhrases) {
    if (
      !entityMatchesPhrase(entity, subject) &&
      !entityMatchesPhrase(entity, normalizeEntityPhrase(subject) || subject)
    ) {
      continue;
    }

    if (
      phrasesAlign(normalized, subject) ||
      phrasesAlign(normalized, normalizeEntityPhrase(subject) || subject)
    ) {
      return true;
    }

    for (const candidate of catalog.values()) {
      if (
        (
          entityMatchesPhrase(candidate, subject) ||
          entityMatchesPhrase(
            candidate,
            normalizeEntityPhrase(subject) || subject
          )
        ) &&
        (
          entityMatchesPhrase(candidate, phrase) ||
          entityMatchesPhrase(candidate, normalized)
        )
      ) {
        return true;
      }
    }
  }

  return false;

}

function answerMentionsEndpoint(
  answer: string,
  endpointId: string,
  catalog: Map<string, AttributionEntity>,
  subjectPhrases: string[]
): boolean {

  const entity =
    catalog.get(endpointId) ??
    synthesizeEndpoint(endpointId);

  const candidates =
    uniqueNonEmpty([
      entity.label,
      endpointId,
      endpointId.includes(":")
        ? endpointId.slice(endpointId.indexOf(":") + 1)
        : endpointId,
      ...Object.values(entity.properties ?? {})
        .filter(
          value =>
            typeof value === "string" ||
            typeof value === "number"
        )
        .map(String),
      ...subjectPhrases.filter(subject =>
        entityMatchesPhrase(entity, subject)
      )
    ]);

  const lower =
    answer.toLowerCase();

  return candidates.some(candidate => {
    const normalized =
      normalizeEntityPhrase(candidate) || candidate;

    return (
      lower.includes(candidate.toLowerCase()) ||
      lower.includes(normalized.toLowerCase()) ||
      compact(answer).includes(compact(normalized))
    );
  });

}

function uniqueNonEmpty(
  values: string[]
): string[] {

  const seen =
    new Set<string>();

  const out: string[] = [];

  for (const value of values) {
    const trimmed =
      value.trim();

    if (!trimmed) {
      continue;
    }

    const key =
      trimmed.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(trimmed);
  }

  return out;

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
