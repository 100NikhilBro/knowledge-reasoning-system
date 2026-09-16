import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  AnalyticalFilter,
  AnalyticalOperation,
  AnalyticalSpec
} from "./query-understanding.js";

/**
 * Analytical execution status (P6).
 */
export type AnalyticalStatus =
  | "SUPPORTED"
  | "SUPPORTED_EXISTS"
  | "SUPPORTED_NOT_EXISTS"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_SUPPORTED";

export interface AnalyticalMatchedItem {
  entityId: string;
  label: string;
  entityType: string;
  source: string;
  relationshipType?: string;
  numericValue?: number;
}

/**
 * Deterministic analytical result over grounded evidence only.
 */
export interface AnalyticalResult {
  operation: AnalyticalOperation;
  status: AnalyticalStatus;
  /**
   * Scalar result for COUNT / MIN / MAX / EXISTS (0|1).
   */
  value?: number | boolean;
  /**
   * Matched canonical entities (post-dedup) that produced the result.
   */
  matchedEntities: AnalyticalMatchedItem[];
  /**
   * Pre-dedup evidence entity ids observed (audit).
   */
  inputEntityIds: string[];
  /**
   * Deduplicated canonical ids used for cardinality.
   */
  deduplicatedEntityIds: string[];
  subject?: string;
  filters?: AnalyticalFilter;
  numericField?: string;
  scope: string;
  explanation: string;
  /**
   * Evidence items that contributed to the calculation.
   */
  evidence: Evidence[];
}

function phraseMatch(
  entity: KnowledgeEntity,
  phrase: string
): boolean {

  const needle =
    phrase.toLowerCase().replace(/[^\w]/g, "");

  if (!needle) {
    return false;
  }

  const haystack =
    [
      entity.id,
      entity.label,
      ...Object.values(entity.properties ?? {})
    ]
      .filter(
        value =>
          typeof value === "string" ||
          typeof value === "number"
      )
      .join(" ")
      .toLowerCase()
      .replace(/[^\w]/g, "");

  return haystack.includes(needle);

}

function parseNumericProperty(
  entity: KnowledgeEntity,
  field: string
): number | undefined {

  const raw =
    entity.properties?.[field];

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string" && raw.trim()) {
    const match =
      raw.match(/(\d+(?:\.\d+)?)/);

    if (match) {
      const value =
        Number(match[1]);

      if (Number.isFinite(value)) {
        return value;
      }
    }
  }

  return undefined;

}

function relationshipsOf(
  evidence: Evidence[]
): KnowledgeRelationship[] {

  const seen =
    new Set<string>();

  const rows: KnowledgeRelationship[] = [];

  for (const item of evidence) {
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

function entityIndex(
  evidence: Evidence[]
): Map<string, KnowledgeEntity> {

  const map =
    new Map<string, KnowledgeEntity>();

  for (const item of evidence) {
    if (!map.has(item.entity.id)) {
      map.set(item.entity.id, item.entity);
    }
  }

  return map;

}

/**
 * Deduplicate evidence by canonical entity id (P0 identity).
 */
export function dedupeEvidenceByEntityId(
  evidence: Evidence[]
): Evidence[] {

  const seen =
    new Set<string>();

  const unique: Evidence[] = [];

  for (const item of evidence) {
    if (seen.has(item.entity.id)) {
      continue;
    }

    seen.add(item.entity.id);
    unique.push(item);
  }

  return unique;

}

function insufficient(
  spec: AnalyticalSpec,
  evidence: Evidence[],
  explanation: string
): AnalyticalResult {

  return {
    operation: spec.operation,
    status: "INSUFFICIENT_EVIDENCE",
    matchedEntities: [],
    inputEntityIds: evidence.map(item => item.entity.id),
    deduplicatedEntityIds: [],
    subject: spec.target,
    filters: spec.filter,
    numericField: spec.numericField,
    scope: spec.scope ?? "current grounded corpus",
    explanation,
    evidence: []
  };

}

function notSupported(
  spec: AnalyticalSpec,
  evidence: Evidence[],
  explanation: string
): AnalyticalResult {

  return {
    operation: spec.operation,
    status: "NOT_SUPPORTED",
    matchedEntities: [],
    inputEntityIds: evidence.map(item => item.entity.id),
    deduplicatedEntityIds: [],
    subject: spec.target,
    filters: spec.filter,
    numericField: spec.numericField,
    scope: spec.scope ?? "current grounded corpus",
    explanation,
    evidence: []
  };

}

/**
 * Select subject entities that satisfy optional relationship/related filters.
 */
function selectMatchingSubjects(
  evidence: Evidence[],
  spec: AnalyticalSpec
): {
  matched: AnalyticalMatchedItem[];
  contributingEvidence: Evidence[];
} {

  const entities =
    entityIndex(evidence);

  const relationships =
    relationshipsOf(evidence);

  const subjectType =
    spec.subjectEntityType ??
    spec.filter?.entityType;

  const filter =
    spec.filter;

  const matchedById =
    new Map<string, AnalyticalMatchedItem>();

  const contributing: Evidence[] = [];

  function considerSubject(
    entity: KnowledgeEntity,
    relationshipType?: string
  ): void {

    if (
      subjectType &&
      entity.type !== subjectType
    ) {
      return;
    }

    if (matchedById.has(entity.id)) {
      return;
    }

    matchedById.set(entity.id, {
      entityId: entity.id,
      label: entity.label,
      entityType: entity.type,
      source: entity.source,
      ...(relationshipType
        ? { relationshipType }
        : {}),
      ...(spec.numericField
        ? {
            numericValue:
              parseNumericProperty(entity, spec.numericField)
          }
        : {})
    });
  }

  /*
   * Relationship-filtered selection: subject is the Proposal (from) side
   * for INTRODUCES/ADDRESSES/PROPOSED_BY when counting PEPs.
   */
  if (filter?.relationshipType) {
    for (const relationship of relationships) {
      if (relationship.type !== filter.relationshipType) {
        continue;
      }

      const from =
        entities.get(relationship.from);

      const to =
        entities.get(relationship.to);

      if (!from || !to) {
        continue;
      }

      if (filter.relatedEntityPhrase) {
        const relatedOk =
          phraseMatch(to, filter.relatedEntityPhrase) ||
          phraseMatch(from, filter.relatedEntityPhrase);

        if (!relatedOk) {
          continue;
        }
      }

      const subject =
        subjectType === "Proposal" ||
        subjectType === undefined
          ? (
              from.type === "Proposal"
                ? from
                : to.type === "Proposal"
                  ? to
                  : from
            )
          : (
              from.type === subjectType
                ? from
                : to.type === subjectType
                  ? to
                  : undefined
            );

      if (!subject) {
        continue;
      }

      considerSubject(subject, relationship.type);

      for (const item of evidence) {
        if (
          item.entity.id === from.id ||
          item.entity.id === to.id ||
          item.relationship &&
          item.relationship.from === relationship.from &&
          item.relationship.to === relationship.to &&
          item.relationship.type === relationship.type
        ) {
          contributing.push(item);
        }
      }
    }

    return {
      matched: [...matchedById.values()],
      contributingEvidence: dedupeEvidenceByEntityId(contributing)
    };
  }

  /*
   * Type-only / related-phrase selection without relationship filter.
   */
  for (const item of evidence) {
    const entity =
      item.entity;

    if (
      subjectType &&
      entity.type !== subjectType
    ) {
      continue;
    }

    if (
      filter?.relatedEntityPhrase &&
      !phraseMatch(entity, filter.relatedEntityPhrase)
    ) {
      continue;
    }

    considerSubject(entity, item.relationship?.type);
    contributing.push(item);
  }

  return {
    matched: [...matchedById.values()],
    contributingEvidence: dedupeEvidenceByEntityId(contributing)
  };

}

/**
 * Execute a deterministic analytical operation over grounded evidence.
 */
export function executeAnalytical(
  spec: AnalyticalSpec,
  evidence: Evidence[]
): AnalyticalResult {

  const scope =
    spec.scope ?? "current grounded corpus";

  const inputEntityIds =
    evidence.map(item => item.entity.id);

  if (
    spec.operation === "UNKNOWN" ||
    spec.operation === "AVG"
  ) {
    return notSupported(
      spec,
      evidence,
      spec.operation === "AVG"
        ? "AVG is not supported without a reliable structured numeric field in the corpus."
        : "Analytical operation could not be determined unambiguously."
    );
  }

  if (
    (
      spec.operation === "MIN" ||
      spec.operation === "MAX"
    ) &&
    !spec.numericField
  ) {
    return notSupported(
      spec,
      evidence,
      "MIN/MAX requires an explicit structured numeric field; none is available for this query."
    );
  }

  if (evidence.length === 0) {
    return insufficient(
      spec,
      evidence,
      "No grounded evidence available; cannot execute analytical operation over an empty corpus sample."
    );
  }

  const { matched, contributingEvidence } =
    selectMatchingSubjects(evidence, spec);

  const deduplicatedEntityIds =
    matched.map(item => item.entityId);

  if (
    spec.operation === "COUNT" ||
    spec.operation === "DISTINCT_COUNT"
  ) {
    return {
      operation: spec.operation,
      status: "SUPPORTED",
      value: matched.length,
      matchedEntities: matched,
      inputEntityIds,
      deduplicatedEntityIds,
      subject: spec.target,
      filters: spec.filter,
      scope,
      explanation:
        `Counted ${matched.length} distinct ${spec.target ?? "entities"}` +
        (spec.filter?.relationshipType
          ? ` with ${spec.filter.relationshipType}`
          : "") +
        (spec.filter?.relatedEntityPhrase
          ? ` related to ${spec.filter.relatedEntityPhrase}`
          : "") +
        ` within ${scope}.`,
      evidence: contributingEvidence
    };
  }

  if (spec.operation === "LIST") {
    if (matched.length === 0) {
      return {
        operation: "LIST",
        status: "SUPPORTED",
        value: 0,
        matchedEntities: [],
        inputEntityIds,
        deduplicatedEntityIds: [],
        subject: spec.target,
        filters: spec.filter,
        scope,
        explanation:
          `No matching ${spec.target ?? "entities"} found in ${scope} for the requested filter.`,
        evidence: []
      };
    }

    return {
      operation: "LIST",
      status: "SUPPORTED",
      value: matched.length,
      matchedEntities: matched,
      inputEntityIds,
      deduplicatedEntityIds,
      subject: spec.target,
      filters: spec.filter,
      scope,
      explanation:
        `Listed ${matched.length} matching ${spec.target ?? "entities"} within ${scope}.`,
      evidence: contributingEvidence
    };
  }

  if (spec.operation === "EXISTS") {
    if (matched.length > 0) {
      return {
        operation: "EXISTS",
        status: "SUPPORTED_EXISTS",
        value: true,
        matchedEntities: matched,
        inputEntityIds,
        deduplicatedEntityIds,
        subject: spec.target,
        filters: spec.filter,
        scope,
        explanation:
          `At least one matching ${spec.target ?? "entity"} exists in ${scope}.`,
        evidence: contributingEvidence
      };
    }

    /*
     * Absence among grounded evidence is not global non-existence unless
     * we have a non-empty corpus sample that was filtered.
     */
    const hasCorpusSample =
      evidence.some(item =>
        !spec.subjectEntityType ||
        item.entity.type === spec.subjectEntityType ||
        item.entity.type === "Proposal"
      );

    if (hasCorpusSample) {
      return {
        operation: "EXISTS",
        status: "SUPPORTED_NOT_EXISTS",
        value: false,
        matchedEntities: [],
        inputEntityIds,
        deduplicatedEntityIds: [],
        subject: spec.target,
        filters: spec.filter,
        scope,
        explanation:
          `No matching ${spec.target ?? "entity"} found among grounded evidence in ${scope} (not a universal claim).`,
        evidence: []
      };
    }

    return insufficient(
      spec,
      evidence,
      "Insufficient grounded evidence to conclude existence or non-existence."
    );
  }

  if (
    spec.operation === "MIN" ||
    spec.operation === "MAX"
  ) {
    const field =
      spec.numericField as string;

    const numericItems =
      matched
        .map(item => {
          const entity =
            entityIndex(evidence).get(item.entityId);

          if (!entity) {
            return undefined;
          }

          const numericValue =
            parseNumericProperty(entity, field);

          if (numericValue === undefined) {
            return undefined;
          }

          return {
            ...item,
            numericValue
          };
        })
        .filter(
          (item): item is AnalyticalMatchedItem & { numericValue: number } =>
            item !== undefined &&
            typeof item.numericValue === "number"
        );

    if (numericItems.length === 0) {
      return notSupported(
        spec,
        evidence,
        `No structured numeric values for field "${field}" among matched entities.`
      );
    }

    const selected =
      spec.operation === "MIN"
        ? numericItems.reduce((best, item) =>
            item.numericValue < best.numericValue ? item : best
          )
        : numericItems.reduce((best, item) =>
            item.numericValue > best.numericValue ? item : best
          );

    return {
      operation: spec.operation,
      status: "SUPPORTED",
      value: selected.numericValue,
      matchedEntities: [selected],
      inputEntityIds,
      deduplicatedEntityIds: [selected.entityId],
      subject: spec.target,
      filters: spec.filter,
      numericField: field,
      scope,
      explanation:
        `${spec.operation} ${field}=${selected.numericValue} for ${selected.label} (${selected.entityId}) within ${scope}.`,
      evidence: contributingEvidence.filter(item =>
        item.entity.id === selected.entityId
      )
    };
  }

  return notSupported(
    spec,
    evidence,
    `Unsupported analytical operation: ${spec.operation}`
  );

}

/**
 * Deterministic prose from an analytical result (no LLM calculation).
 */
export function formatAnalyticalAnswer(
  result: AnalyticalResult
): string {

  if (
    result.status === "NOT_SUPPORTED" ||
    result.status === "INSUFFICIENT_EVIDENCE"
  ) {
    return (
      `Analytical result: ${result.status}. ${result.explanation}`
    );
  }

  if (
    result.operation === "COUNT" ||
    result.operation === "DISTINCT_COUNT"
  ) {
    const ids =
      result.deduplicatedEntityIds.join(", ") || "(none)";

    return (
      `Count of distinct ${result.subject ?? "entities"}` +
      ` in ${result.scope}: ${result.value}. ` +
      `Matched canonical IDs: [${ids}].`
    );
  }

  if (result.operation === "LIST") {
    if (result.matchedEntities.length === 0) {
      return (
        `No matching ${result.subject ?? "entities"} in ${result.scope}.`
      );
    }

    const lines =
      result.matchedEntities.map(item =>
        `- ${item.label} (${item.entityId})` +
        (item.relationshipType
          ? ` via ${item.relationshipType}`
          : "")
      );

    return (
      `Matching ${result.subject ?? "entities"} in ${result.scope}:\n` +
      lines.join("\n")
    );
  }

  if (result.operation === "EXISTS") {
    if (result.status === "SUPPORTED_EXISTS") {
      const ids =
        result.deduplicatedEntityIds.join(", ");

      return (
        `Yes — at least one matching ${result.subject ?? "entity"} exists ` +
        `in ${result.scope}. Matched: [${ids}].`
      );
    }

    return (
      `No matching ${result.subject ?? "entity"} was found among grounded evidence ` +
      `in ${result.scope}. This is not a claim about the entire Python ecosystem.`
    );
  }

  if (
    result.operation === "MIN" ||
    result.operation === "MAX"
  ) {
    const item =
      result.matchedEntities[0];

    return (
      `${result.operation} ${result.numericField ?? "value"} in ${result.scope}: ` +
      `${result.value}` +
      (item
        ? ` (${item.label} / ${item.entityId})`
        : "") +
      "."
    );
  }

  return result.explanation;

}

/**
 * Trace line summarizing the analytical execution.
 */
export function formatAnalyticalTraceStep(
  result: AnalyticalResult
): string {

  return (
    `Analytical: ${result.operation} status=${result.status}` +
    (result.value !== undefined ? ` value=${String(result.value)}` : "") +
    ` matched=[${result.deduplicatedEntityIds.join(",")}]` +
    ` scope=${result.scope}`
  );

}
