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
  /**
   * Relationship object entity id when the match came from a typed edge.
   */
  objectEntityId?: string;
  /**
   * Relationship object label when available.
   */
  objectLabel?: string;
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
   * Explicit universe of candidate subjects when complement analysis ran.
   */
  universeEntityIds?: string[];
  /**
   * Non-matching subjects from the universe (negative/complement set).
   */
  nonMatchingEntities?: AnalyticalMatchedItem[];
  /**
   * Whether the requested relationship object/target was established in evidence.
   */
  requestedTargetEstablished?: boolean;
  /**
   * Echo of requested outputs for verification.
   */
  requestedOutputs?: Array<"count" | "list" | "complement">;
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

function compactPhrase(
  value: string
): string {

  return value
    .toLowerCase()
    .replace(/[^\w]+/g, "");

}

function idLocalName(
  id: string
): string {

  const parts =
    id.split(":");

  return parts[parts.length - 1] ?? id;

}

/**
 * Exact analytical object/target match.
 * Equality on compact label / local id / name — not broad substring matching.
 */
export function exactObjectMatch(
  entity: KnowledgeEntity,
  phrase: string
): boolean {

  const needle =
    compactPhrase(phrase);

  if (!needle) {
    return false;
  }

  const candidates =
    [
      entity.label,
      idLocalName(entity.id),
      typeof entity.properties?.name === "string"
        ? entity.properties.name
        : undefined
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(compactPhrase);

  return candidates.some(candidate => candidate === needle);

}

function phraseMatch(
  entity: KnowledgeEntity,
  phrase: string
): boolean {

  /*
   * Legacy soft path — still used only when requireObjectMatch is false.
   * Prefer exactObjectMatch for relationship object binding.
   */
  return exactObjectMatch(entity, phrase) ||
    compactPhrase(
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
    ).includes(compactPhrase(phrase));

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
  explanation: string,
  extras: Partial<AnalyticalResult> = {}
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
    evidence: [],
    requestedOutputs: spec.requestedOutputs,
    ...extras
  };

}

function notSupported(
  spec: AnalyticalSpec,
  evidence: Evidence[],
  explanation: string,
  extras: Partial<AnalyticalResult> = {}
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
    evidence: [],
    requestedOutputs: spec.requestedOutputs,
    ...extras
  };

}

function objectEndpointMatches(
  entity: KnowledgeEntity,
  filter: AnalyticalFilter
): boolean {

  if (filter.objectPhrase && filter.requireObjectMatch) {
    return exactObjectMatch(entity, filter.objectPhrase);
  }

  if (filter.objectPhrase) {
    return exactObjectMatch(entity, filter.objectPhrase);
  }

  if (filter.relatedEntityPhrase) {
    return phraseMatch(entity, filter.relatedEntityPhrase);
  }

  return true;

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
  requestedTargetEstablished: boolean;
  universe: AnalyticalMatchedItem[];
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

  const universeById =
    new Map<string, AnalyticalMatchedItem>();

  for (const entity of entities.values()) {
    if (
      subjectType &&
      entity.type !== subjectType
    ) {
      continue;
    }

    universeById.set(entity.id, {
      entityId: entity.id,
      label: entity.label,
      entityType: entity.type,
      source: entity.source,
      ...(spec.numericField
        ? {
            numericValue:
              parseNumericProperty(entity, spec.numericField)
          }
        : {})
    });
  }

  function considerSubject(
    entity: KnowledgeEntity,
    relationshipType?: string,
    objectEntity?: KnowledgeEntity
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
      ...(objectEntity
        ? {
            objectEntityId: objectEntity.id,
            objectLabel: objectEntity.label
          }
        : {}),
      ...(spec.numericField
        ? {
            numericValue:
              parseNumericProperty(entity, spec.numericField)
          }
        : {})
    });
  }

  let requestedTargetEstablished =
    true;

  if (
    filter?.requireObjectMatch &&
    filter.objectPhrase
  ) {
    requestedTargetEstablished =
      [...entities.values()].some(entity =>
        exactObjectMatch(entity, filter.objectPhrase!)
      );
  }

  /*
   * Relationship-filtered selection: subject is the Proposal (from) side
   * for INTRODUCES/ADDRESSES/PROPOSED_BY when counting PEPs.
   * Object constraints bind only to the relationship object (`to`).
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

      if (
        filter.objectPhrase ||
        filter.relatedEntityPhrase
      ) {
        /*
         * Exact/soft object binding applies to the relationship object only.
         * Never let a subject-side lexical hit satisfy the object constraint.
         */
        if (!objectEndpointMatches(to, filter)) {
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

      /*
       * Prefer the ontology direction: subject owns the outbound edge.
       */
      if (
        subjectType &&
        from.type === subjectType &&
        subject.id !== from.id
      ) {
        continue;
      }

      considerSubject(subject, relationship.type, to);

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
      contributingEvidence: dedupeEvidenceByEntityId(contributing),
      requestedTargetEstablished,
      universe: [...universeById.values()]
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
      filter?.objectPhrase &&
      filter.requireObjectMatch &&
      !exactObjectMatch(entity, filter.objectPhrase)
    ) {
      continue;
    }

    if (
      !filter?.objectPhrase &&
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
    contributingEvidence: dedupeEvidenceByEntityId(contributing),
    requestedTargetEstablished,
    universe: [...universeById.values()]
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

  const {
    matched,
    contributingEvidence,
    requestedTargetEstablished,
    universe
  } =
    selectMatchingSubjects(evidence, spec);

  if (
    spec.filter?.requireObjectMatch &&
    spec.filter.objectPhrase &&
    !requestedTargetEstablished
  ) {
    if (spec.operation === "EXISTS") {
      /*
       * Existence asks may conclude absence among grounded evidence without
       * requiring the object node to be present as a standalone entity.
       */
    } else {
      /*
       * Fail closed: do not broaden to unrelated relationship objects.
       * Report zero matches with an explicit unresolved-target flag.
       */
      const emptyComplement = {
        requestedTargetEstablished: false,
        requestedOutputs: spec.requestedOutputs,
        universeEntityIds: universe.map(item => item.entityId),
        ...(spec.includeComplement
          ? {
              nonMatchingEntities:
                spec.includeComplement && universe.length === 0
                  ? []
                  : universe
            }
          : {})
      };

      if (spec.includeComplement && universe.length === 0) {
        return insufficient(
          spec,
          evidence,
          "Cannot compute a negative/complement set because no explicit subject universe is available in grounded evidence.",
          emptyComplement
        );
      }

      return {
        operation: spec.operation,
        status: "SUPPORTED",
        value: 0,
        matchedEntities: [],
        inputEntityIds,
        deduplicatedEntityIds: [],
        subject: spec.target,
        filters: spec.filter,
        scope,
        explanation:
          `Requested analytical target "${spec.filter.objectPhrase}" could not be established in grounded evidence; ` +
          `returning zero matches without broadening to unrelated entities.`,
        evidence: [],
        ...emptyComplement
      };
    }
  }

  const matchedIds =
    new Set(matched.map(item => item.entityId));

  const nonMatching =
    universe.filter(item => !matchedIds.has(item.entityId));

  if (spec.includeComplement) {
    if (universe.length === 0) {
      return insufficient(
        spec,
        evidence,
        "Cannot compute a negative/complement set because no explicit subject universe is available in grounded evidence.",
        {
          requestedTargetEstablished,
          universeEntityIds: [],
          nonMatchingEntities: []
        }
      );
    }
  }

  const deduplicatedEntityIds =
    matched.map(item => item.entityId);

  const complementFields = {
    requestedTargetEstablished,
    requestedOutputs: spec.requestedOutputs,
    universeEntityIds: universe.map(item => item.entityId),
    ...(spec.includeComplement
      ? { nonMatchingEntities: nonMatching }
      : {})
  };

  const objectClause =
    spec.filter?.objectPhrase
      ? ` object=${spec.filter.objectPhrase}`
      : spec.filter?.relatedEntityPhrase
        ? ` related to ${spec.filter.relatedEntityPhrase}`
        : "";

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
        objectClause +
        (spec.includeComplement
          ? `; non-matching ${nonMatching.length} of universe ${universe.length}`
          : "") +
        ` within ${scope}.`,
      evidence: contributingEvidence,
      ...complementFields
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
          `No matching ${spec.target ?? "entities"} found in ${scope} for the requested filter` +
          objectClause +
          ".",
        evidence: [],
        ...complementFields
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
        `Listed ${matched.length} matching ${spec.target ?? "entities"} within ${scope}` +
        objectClause +
        ".",
      evidence: contributingEvidence,
      ...complementFields
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
          `At least one matching ${spec.target ?? "entity"} exists in ${scope}` +
          objectClause +
          ".",
        evidence: contributingEvidence,
        ...complementFields
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
          `No matching ${spec.target ?? "entity"} found among grounded evidence in ${scope} (not a universal claim)` +
          objectClause +
          ".",
        evidence: [],
        ...complementFields
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

    let answer =
      `Count of distinct ${result.subject ?? "entities"}` +
      ` in ${result.scope}: ${result.value}. ` +
      `Matched canonical IDs: [${ids}].`;

    if (
      result.filters?.objectPhrase ||
      result.filters?.relationshipType
    ) {
      answer +=
        ` Constraint: subject=${result.subject ?? "?"}` +
        (result.filters?.relationshipType
          ? ` -[${result.filters.relationshipType}]->`
          : "") +
        (result.filters?.objectPhrase
          ? ` ${result.filters.objectPhrase}`
          : "") +
        ".";
    }

    if (
      result.requestedOutputs?.includes("complement") ||
      result.nonMatchingEntities
    ) {
      const universe =
        (result.universeEntityIds ?? []).join(", ") || "(none)";

      const nonMatching =
        (result.nonMatchingEntities ?? [])
          .map(item => item.entityId)
          .join(", ") || "(none)";

      answer +=
        ` Universe: [${universe}].` +
        ` Non-matching: [${nonMatching}].`;
    }

    return answer;
  }

  if (result.operation === "LIST") {
    if (result.matchedEntities.length === 0) {
      let answer =
        `No matching ${result.subject ?? "entities"} in ${result.scope}` +
        (result.filters?.objectPhrase
          ? ` for object=${result.filters.objectPhrase}`
          : "") +
        ".";

      if (result.nonMatchingEntities) {
        const nonMatching =
          result.nonMatchingEntities
            .map(item => item.entityId)
            .join(", ") || "(none)";

        answer +=
          ` Non-matching universe members: [${nonMatching}].`;
      }

      return answer;
    }

    const lines =
      result.matchedEntities.map(item =>
        `- ${item.label} (${item.entityId})` +
        (item.relationshipType
          ? ` via ${item.relationshipType}`
          : "") +
        (item.objectLabel
          ? ` → ${item.objectLabel}`
          : "")
      );

    let answer =
      `Matching ${result.subject ?? "entities"} in ${result.scope}:\n` +
      lines.join("\n");

    if (result.nonMatchingEntities) {
      const nonLines =
        result.nonMatchingEntities.map(item =>
          `- ${item.label} (${item.entityId})`
        );

      answer +=
        `\nNon-matching ${result.subject ?? "entities"}:\n` +
        (nonLines.length > 0 ? nonLines.join("\n") : "- (none)");
    }

    return answer;
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
