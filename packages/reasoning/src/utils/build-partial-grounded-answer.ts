import type {
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  GroundedEvidenceItem,
  ReasoningContext
} from "../types/reasoning-context.js";

import {
  buildGroundedCorpus,
  corpusAttests
} from "./build-grounded-corpus.js";

import {
  classifyRelationalSupport
} from "./classify-relational-support.js";

/**
 * Explicit insufficiency clause — only discourse / non-factual wording.
 * Used when evidence supports entity labels but not relational synthesis,
 * or when the caller needs to mark unsupported remainder explicitly.
 */
export const INSUFFICIENT_EVIDENCE_CLAUSE =
  "The available evidence does not support additional claims beyond these grounded facts.";

/**
 * Entities were found, but the requested relationship is not attested.
 */
export const RELATIONSHIP_NOT_ESTABLISHED_CLAUSE =
  "The relevant entities were found, but the available evidence does not establish the requested relationship.";

/**
 * Fixed paraphrases of relationship types into natural verbs.
 * These are labels for attested edge types — not invented causal mechanisms.
 */
const RELATIONSHIP_VERBS: Record<string, string> = {
  INTRODUCES: "introduced",
  ADDRESSES: "addressed",
  PROPOSED_BY: "was proposed by",
  RESULTS_IN: "resulted in",
  IMPLEMENTED_IN: "was implemented in"
};

function uniqueItems(
  context: ReasoningContext
): GroundedEvidenceItem[] {

  const seen =
    new Set<string>();

  const items: GroundedEvidenceItem[] = [];

  for (const item of context.items) {
    if (seen.has(item.entityId)) {
      continue;
    }
    seen.add(item.entityId);
    items.push(item);
  }

  return items;

}

function codedTopicLabel(
  item: GroundedEvidenceItem
): string | undefined {

  const pep =
    item.properties?.pep ??
    item.properties?.PEP;

  if (
    typeof pep === "string" ||
    typeof pep === "number"
  ) {
    return `PEP-${pep}`;
  }

  const protocol =
    item.properties?.protocol ??
    item.properties?.handbook;

  if (
    typeof protocol === "string" ||
    typeof protocol === "number"
  ) {
    return String(protocol);
  }

  const idTail =
    item.entityId.includes(":")
      ? item.entityId.slice(item.entityId.indexOf(":") + 1)
      : undefined;

  if (
    idTail &&
    /^[A-Za-z]+-\d+/i.test(idTail)
  ) {
    return idTail;
  }

  return undefined;

}

/**
 * Natural-prose identity answer from grounded entities (and relationships
 * when present). Never invents motives, history, or unattested details.
 */
export function buildIdentityGroundedAnswer(
  context: ReasoningContext
): string {

  const relational =
    buildRelationalGroundedAnswer(context);

  const items =
    uniqueItems(context);

  if (items.length === 0) {
    return relational ?? "";
  }

  const primary =
    items.find(item => item.entityType === "Proposal") ??
    items[0];

  if (!primary) {
    return relational ?? "";
  }

  const code =
    codedTopicLabel(primary);

  const lead =
    code && code.toLowerCase() !== primary.label.toLowerCase()
      ? `${code} (${primary.label}) is a ${primary.entityType.toLowerCase()}.`
      : `${primary.label} is a ${primary.entityType.toLowerCase()}.`;

  if (relational) {
    return `${lead} ${relational}`;
  }

  const others =
    items.filter(item => item.entityId !== primary.entityId);

  if (others.length === 0) {
    return lead;
  }

  const listed =
    others
      .map(item => `${item.label} (${item.entityType})`)
      .join(", ");

  return `${lead} Related grounded entities include ${listed}.`;

}

function isIdentityQuery(
  query: string | undefined
): boolean {

  if (!query) {
    return false;
  }

  const normalized =
    query.trim().toLowerCase();

  return (
    /^what is\b/.test(normalized) ||
    /^what are\b/.test(normalized)
  );

}

function labelForId(
  context: ReasoningContext,
  id: string
): string {

  const item =
    context.items.find(
      entry => entry.entityId === id
    );

  if (item?.label) {
    return item.label;
  }

  const evidence =
    context.evidence.find(
      entry => entry.entity.id === id
    );

  return evidence?.entity.label ?? id;

}

function relationshipSentence(
  context: ReasoningContext,
  relationship: KnowledgeRelationship
): string {

  const source =
    labelForId(context, relationship.from);

  const target =
    labelForId(context, relationship.to);

  const verb =
    RELATIONSHIP_VERBS[relationship.type];

  if (verb) {
    return `${source} ${verb} ${target}.`;
  }

  return `${source} ${relationship.type} ${target}.`;

}

/**
 * Deterministic natural-language synthesis from attested relationships only.
 * Never invents motivation, mechanism, benefit, or intent.
 */
export function buildRelationalGroundedAnswer(
  context: ReasoningContext,
  allowedTypes?: Set<string>
): string | undefined {

  const seen =
    new Set<string>();

  const sentences: string[] = [];

  const sources: Array<GroundedEvidenceItem | {
    relationship?: KnowledgeRelationship;
  }> = [
    ...context.items,
    ...context.evidence.map(item => ({
      relationship: item.relationship
    }))
  ];

  for (const item of sources) {

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    if (
      allowedTypes &&
      !allowedTypes.has(relationship.type)
    ) {
      continue;
    }

    const key =
      `${relationship.from}|${relationship.type}|${relationship.to}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sentences.push(
      relationshipSentence(context, relationship)
    );

  }

  if (sentences.length === 0) {
    return undefined;
  }

  return sentences.join(" ");

}

export function buildRelationshipNotEstablishedAnswer(
  context: ReasoningContext
): string {

  const identity =
    buildIdentityGroundedAnswer(context).trim();

  if (identity.length === 0) {
    return RELATIONSHIP_NOT_ESTABLISHED_CLAUSE;
  }

  /*
   * Prefer a short entity summary without weaving relationship sentences
   * that would imply the missing ask is answered.
   */
  const items =
    uniqueItems(context);

  if (items.length === 0) {
    return RELATIONSHIP_NOT_ESTABLISHED_CLAUSE;
  }

  const listed =
    items
      .map(item => `${item.label} (${item.entityType})`)
      .join(", ");

  return `${listed}. ${RELATIONSHIP_NOT_ESTABLISHED_CLAUSE}`;

}

/**
 * Detect query causal extras that are not attested by the grounded corpus.
 * Returns a short bound phrase, or undefined when none are found.
 */
export function detectUnsupportedCausalRemainder(
  query: string | undefined,
  context: ReasoningContext
): string | undefined {

  if (!query) {
    return undefined;
  }

  const corpus =
    buildGroundedCorpus(context);

  const patterns: RegExp[] = [
    /\bto (?:improve|increase|reduce|help|make|enable|allow)\s+[^?.!]{3,80}/gi,
    /\bbecause\s+[^?.!]{3,80}/gi,
    /\bin order to\s+[^?.!]{3,80}/gi,
    /\bso that\s+[^?.!]{3,80}/gi,
    /\bfor beginners\b/gi,
    /\bto improve performance\b/gi,
    /\bwhat award(?:s)?(?:\s+did\s+\w+\s+win)?\b/gi,
    /\bawards?\s+did\s+\w+\s+win\b/gi
  ];

  for (const pattern of patterns) {
    for (const match of query.matchAll(pattern)) {
      const phrase =
        (match[0] ?? "").trim().replace(/[.,;:]+$/, "");

      if (phrase.length < 3) {
        continue;
      }

      if (!corpusAttests(corpus, phrase)) {
        return phrase;
      }
    }
  }

  return undefined;

}

function missingRelationshipClause(
  missing: string[]
): string {

  if (missing.length === 0) {
    return RELATIONSHIP_NOT_ESTABLISHED_CLAUSE;
  }

  if (
    missing.length === 1 &&
    missing[0] === "CONNECTED"
  ) {
    return RELATIONSHIP_NOT_ESTABLISHED_CLAUSE;
  }

  const labels =
    missing
      .filter(type => type !== "CONNECTED")
      .join(", ");

  if (!labels) {
    return RELATIONSHIP_NOT_ESTABLISHED_CLAUSE;
  }

  return `The available evidence does not establish the requested ${labels} relationship.`;

}

/**
 * Deterministic grounded answer used when LLM output fails verification
 * or when callers need an explicit partial-evidence form.
 *
 * Distinguishes:
 * - relationship not established (entities present, requested edge absent)
 * - partial claim support (some requested edges present)
 * - full relational synthesis
 * - label-only insufficiency
 */
export function buildPartialGroundedAnswer(
  context: ReasoningContext
): string {

  if (context.comparison !== undefined) {
    return context.comparison;
  }

  if (context.evidence.length === 0) {
    return "";
  }

  const support =
    classifyRelationalSupport(
      context.query,
      context
    );

  if (support.kind === "relationship_missing") {
    return buildRelationshipNotEstablishedAnswer(context);
  }

  if (support.kind === "partial") {
    const established =
      buildRelationalGroundedAnswer(
        context,
        new Set(support.established)
      );

    const bound =
      missingRelationshipClause(support.missing);

    const causal =
      detectUnsupportedCausalRemainder(
        context.query,
        context
      );

    const parts =
      [
        established,
        bound,
        causal
          ? `The available evidence does not establish ${causal}.`
          : undefined
      ]
        .filter(
          (part): part is string =>
            Boolean(part && part.trim())
        );

    return parts.join(" ");
  }

  const relational =
    buildRelationalGroundedAnswer(context);

  if (relational) {
    const causal =
      detectUnsupportedCausalRemainder(
        context.query,
        context
      );

    if (isIdentityQuery(context.query)) {
      const identity =
        buildIdentityGroundedAnswer(context);

      if (causal) {
        return `${identity} The available evidence does not establish ${causal}.`;
      }

      return identity;
    }

    if (causal) {
      return `${relational} The available evidence does not establish ${causal}.`;
    }

    return relational;
  }

  if (isIdentityQuery(context.query)) {
    return buildIdentityGroundedAnswer(context);
  }

  const identity =
    buildIdentityGroundedAnswer(context).trim();

  if (identity.length === 0) {
    return "";
  }

  return `${identity} ${INSUFFICIENT_EVIDENCE_CLAUSE}`;

}
