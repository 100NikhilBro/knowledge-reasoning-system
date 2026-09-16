import type {
  Evidence,
  EvidenceSet,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  entityMatchesPhrase
} from "./detect-relationship-between-query.js";

import type {
  ComparisonDimension,
  ComparisonRequest
} from "./detect-comparison-request.js";

import {
  relationshipTypesForDimensions
} from "./detect-comparison-request.js";

/**
 * Legacy binary set-diff over entity ids (preserved for compatibility).
 */
export interface ComparisonResult {

  common: Evidence[];

  onlyLeft: Evidence[];

  onlyRight: Evidence[];

}

/**
 * One attested relationship fact bound to a comparison subject.
 */
export interface SubjectRelationshipFact {

  type: string;

  from: string;

  to: string;

  /**
   * Opposite endpoint label/id for display and commonality matching.
   */
  targetId: string;

  targetLabel: string;

  direction: "outgoing" | "incoming";

  /**
   * Stable key: type|targetId|direction
   */
  key: string;

}

export interface ComparisonSubjectEvidence {

  subject: string;

  entityId?: string;

  label?: string;

  relationships: SubjectRelationshipFact[];

  properties: Record<string, unknown>;

  supported: boolean;

  unsupportedDimensions: ComparisonDimension[];

}

export interface StructuredComparisonResult {

  subjects: string[];

  dimensions: ComparisonDimension[];

  perSubject: ComparisonSubjectEvidence[];

  /**
   * Facts present for every supported subject (same type + target).
   */
  common: SubjectRelationshipFact[];

  /**
   * Per-subject facts not in the common set.
   */
  differences: Array<{
    subject: string;
    facts: SubjectRelationshipFact[];
  }>;

  unsupportedSubjects: string[];

  unsupportedDimensions: ComparisonDimension[];

}

export function compareEvidence(

  left: EvidenceSet,

  right: EvidenceSet

): ComparisonResult {

  const leftMap =
    new Map(
      left.evidence.map(e => [e.entity.id, e])
    );

  const rightMap =
    new Map(
      right.evidence.map(e => [e.entity.id, e])
    );

  const common: Evidence[] = [];
  const onlyLeft: Evidence[] = [];
  const onlyRight: Evidence[] = [];

  for (const [id, evidence] of leftMap) {
    if (rightMap.has(id)) {
      common.push(evidence);
    } else {
      onlyLeft.push(evidence);
    }
  }

  for (const [id, evidence] of rightMap) {
    if (!leftMap.has(id)) {
      onlyRight.push(evidence);
    }
  }

  return {
    common,
    onlyLeft,
    onlyRight
  };

}

function factKey(
  type: string,
  targetId: string,
  direction: "outgoing" | "incoming"
): string {

  return `${type}|${targetId}|${direction}`;

}

function labelFor(
  evidence: Evidence[],
  id: string
): string {

  const hit =
    evidence.find(item => item.entity.id === id);

  return hit?.entity.label ?? id;

}

function resolveSubjectEntity(
  evidence: Evidence[],
  subject: string
): KnowledgeEntity | undefined {

  const matches =
    evidence
      .map(item => item.entity)
      .filter(entity =>
        entityMatchesPhrase(entity, subject)
      );

  if (matches.length === 0) {
    return undefined;
  }

  /*
   * Prefer Proposal subjects when comparing PEPs; otherwise first match
   * in stable id order for determinism.
   */
  const proposals =
    matches.filter(entity => entity.type === "Proposal");

  const pool =
    proposals.length > 0 ? proposals : matches;

  return [...pool].sort((a, b) =>
    a.id.localeCompare(b.id)
  )[0];

}

function collectFactsForSubject(
  evidence: Evidence[],
  subject: string,
  subjectEntity: KnowledgeEntity,
  allowedTypes: Set<string> | undefined
): SubjectRelationshipFact[] {

  const facts: SubjectRelationshipFact[] = [];
  const seen =
    new Set<string>();

  for (const item of evidence) {
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

    let direction: "outgoing" | "incoming" | undefined;
    let targetId: string | undefined;

    if (relationship.from === subjectEntity.id) {
      direction = "outgoing";
      targetId = relationship.to;
    } else if (relationship.to === subjectEntity.id) {
      direction = "incoming";
      targetId = relationship.from;
    } else {
      continue;
    }

    /*
     * Relationship must belong to this subject — never borrow another
     * subject's edge even when the target coincides.
     */
    if (
      !entityMatchesPhrase(subjectEntity, subject) &&
      relationship.from !== subjectEntity.id &&
      relationship.to !== subjectEntity.id
    ) {
      continue;
    }

    const key =
      factKey(relationship.type, targetId, direction);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    facts.push({
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
      targetId,
      targetLabel: labelFor(evidence, targetId),
      direction,
      key
    });
  }

  return facts.sort((a, b) => a.key.localeCompare(b.key));

}

/**
 * Query-driven N-way comparison over entity-specific relationship evidence.
 * Retrieval/evidence order must not affect the semantic result.
 */
export function buildStructuredComparison(
  request: ComparisonRequest,
  evidence: Evidence[]
): StructuredComparisonResult {

  const allowedTypes =
    relationshipTypesForDimensions(request.dimensions);

  const includeProperties =
    request.dimensions.includes("properties");

  const perSubject: ComparisonSubjectEvidence[] = [];

  for (const subject of request.subjects) {
    const entity =
      resolveSubjectEntity(evidence, subject);

    if (!entity) {
      perSubject.push({
        subject,
        relationships: [],
        properties: {},
        supported: false,
        unsupportedDimensions: [...request.dimensions]
      });
      continue;
    }

    const relationships =
      collectFactsForSubject(
        evidence,
        subject,
        entity,
        allowedTypes
      );

    const properties =
      includeProperties
        ? { ...(entity.properties ?? {}) }
        : {};

    const unsupportedDimensions: ComparisonDimension[] = [];

    if (
      request.dimensions.some(dimension =>
        dimension !== "properties"
      ) &&
      relationships.length === 0
    ) {
      unsupportedDimensions.push(
        ...request.dimensions.filter(dimension =>
          dimension !== "properties"
        )
      );
    }

    if (
      includeProperties &&
      Object.keys(properties).length === 0
    ) {
      unsupportedDimensions.push("properties");
    }

    const supported =
      relationships.length > 0 ||
      Object.keys(properties).length > 0;

    perSubject.push({
      subject,
      entityId: entity.id,
      label: entity.label,
      relationships,
      properties,
      supported,
      unsupportedDimensions
    });
  }

  const supportedSubjects =
    perSubject.filter(item => item.supported);

  const commonKeys =
    supportedSubjects.length > 0
      ? supportedSubjects
          .map(item => new Set(item.relationships.map(fact => fact.key)))
          .reduce((acc, set) => {
            if (!acc) {
              return set;
            }

            return new Set(
              [...acc].filter(key => set.has(key))
            );
          })
      : new Set<string>();

  const common: SubjectRelationshipFact[] = [];
  const commonSeen =
    new Set<string>();

  for (const item of supportedSubjects) {
    for (const fact of item.relationships) {
      if (!commonKeys.has(fact.key) || commonSeen.has(fact.key)) {
        continue;
      }

      commonSeen.add(fact.key);
      common.push(fact);
    }
  }

  common.sort((a, b) => a.key.localeCompare(b.key));

  const differences =
    perSubject.map(item => ({
      subject: item.subject,
      facts: item.relationships.filter(fact =>
        !commonKeys.has(fact.key)
      )
    }));

  const unsupportedSubjects =
    perSubject
      .filter(item => !item.supported)
      .map(item => item.subject);

  const unsupportedDimensions =
    uniqueDimensions(
      perSubject.flatMap(item => item.unsupportedDimensions)
    );

  return {
    subjects: [...request.subjects],
    dimensions: [...request.dimensions],
    perSubject,
    common,
    differences,
    unsupportedSubjects,
    unsupportedDimensions
  };

}

function uniqueDimensions(
  values: ComparisonDimension[]
): ComparisonDimension[] {

  const seen =
    new Set<string>();
  const out: ComparisonDimension[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    out.push(value);
  }

  return out;

}

/**
 * Attach a relationship to the subject entity evidence row when missing.
 */
export function evidenceWithRelationship(
  entity: KnowledgeEntity,
  relationship: KnowledgeRelationship,
  score = 0.95
): Evidence {

  return {
    entity,
    score,
    source: "graph",
    relationship
  };

}
