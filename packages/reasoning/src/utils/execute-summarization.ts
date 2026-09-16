import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  SummarizationMode,
  SummarizationSpec
} from "./query-understanding.js";

import {
  executeAnalytical,
  type AnalyticalResult
} from "./execute-analytical.js";

import {
  detectFocusRelationships
} from "./detect-focus-relationships.js";

/**
 * Summarization execution status (P7).
 */
export type SummarizationStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_SUPPORTED";

export interface DocumentEvidenceGroup {
  documentId: string;
  entities: Array<{
    id: string;
    label: string;
    type: string;
  }>;
  relationships: Array<{
    type: string;
    from: string;
    to: string;
  }>;
  facts: string[];
}

export interface SharedEntityRef {
  id: string;
  label: string;
  type: string;
  documents: string[];
}

export interface SynthesisClaim {
  text: string;
  status: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED";
  evidenceEntityIds: string[];
  sourceDocuments: string[];
}

export interface SummarizationResult {
  mode: SummarizationMode;
  requestedMode: SummarizationMode;
  status: SummarizationStatus;
  scope: string;
  groups: DocumentEvidenceGroup[];
  documentCount: number;
  sharedEntities: SharedEntityRef[];
  /**
   * Only grounded attested relationships — never synthetic PEP↔PEP edges.
   */
  crossDocumentRelations: Array<{
    description: string;
    grounded: boolean;
  }>;
  claims: SynthesisClaim[];
  unsupportedGaps: string[];
  differences: string[];
  analytical?: AnalyticalResult;
  explanation: string;
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

function uniqueRelationships(
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

/**
 * Group evidence by source document; dedupe entities within each document.
 */
export function groupEvidenceByDocument(
  evidence: Evidence[]
): DocumentEvidenceGroup[] {

  const byDoc =
    new Map<string, {
      entities: Map<string, KnowledgeEntity>;
      relationships: Map<string, KnowledgeRelationship>;
    }>();

  for (const item of evidence) {
    const documentId =
      item.entity.source?.trim() || "unknown";

    const bucket =
      byDoc.get(documentId) ?? {
        entities: new Map(),
        relationships: new Map()
      };

    if (!bucket.entities.has(item.entity.id)) {
      bucket.entities.set(item.entity.id, item.entity);
    }

    if (item.relationship) {
      const key =
        `${item.relationship.from}|${item.relationship.type}|${item.relationship.to}`;

      if (!bucket.relationships.has(key)) {
        bucket.relationships.set(key, item.relationship);
      }
    }

    byDoc.set(documentId, bucket);
  }

  const groups: DocumentEvidenceGroup[] = [];

  for (const [documentId, bucket] of byDoc) {
    const entities =
      [...bucket.entities.values()].map(entity => ({
        id: entity.id,
        label: entity.label,
        type: entity.type
      }));

    const relationships =
      [...bucket.relationships.values()].map(relationship => ({
        type: relationship.type,
        from: relationship.from,
        to: relationship.to
      }));

    const labelById =
      new Map(entities.map(entity => [entity.id, entity.label]));

    const facts =
      relationships.map(relationship => {
        const fromLabel =
          labelById.get(relationship.from) ?? relationship.from;
        const toLabel =
          labelById.get(relationship.to) ?? relationship.to;

        return `${fromLabel} → ${relationship.type} → ${toLabel}`;
      });

    /*
     * Entity-only documents still contribute identity facts.
     */
    if (facts.length === 0) {
      for (const entity of entities) {
        facts.push(`${entity.type}: ${entity.label}`);
      }
    }

    groups.push({
      documentId,
      entities,
      relationships,
      facts
    });
  }

  return groups.sort((left, right) =>
    left.documentId.localeCompare(right.documentId)
  );

}

function filterEvidenceForTopics(
  evidence: Evidence[],
  spec: SummarizationSpec
): Evidence[] {

  if (
    spec.topics.length === 0 &&
    spec.relationshipFilters.length === 0
  ) {
    return evidence;
  }

  const entities =
    new Map(
      evidence.map(item => [item.entity.id, item.entity])
    );

  const relationships =
    uniqueRelationships(evidence);

  const keepIds =
    new Set<string>();

  for (const item of evidence) {
    if (
      spec.topics.some(topic =>
        phraseMatch(item.entity, topic)
      )
    ) {
      keepIds.add(item.entity.id);
    }
  }

  for (const relationship of relationships) {
    if (
      spec.relationshipFilters.length > 0 &&
      !spec.relationshipFilters.includes(relationship.type)
    ) {
      continue;
    }

    const from =
      entities.get(relationship.from);

    const to =
      entities.get(relationship.to);

    if (!from || !to) {
      continue;
    }

    const topicOk =
      spec.topics.length === 0 ||
      spec.topics.some(topic =>
        phraseMatch(from, topic) ||
        phraseMatch(to, topic)
      );

    if (!topicOk) {
      continue;
    }

    keepIds.add(from.id);
    keepIds.add(to.id);
  }

  if (keepIds.size === 0) {
    /*
     * Topic filters present but nothing matched — return empty so synthesis
     * can fail closed rather than summarizing unrelated noise.
     */
    if (
      spec.topics.length > 0 ||
      spec.relationshipFilters.length > 0
    ) {
      return [];
    }

    return evidence;
  }

  return evidence.filter(item =>
    keepIds.has(item.entity.id) ||
    (
      item.relationship &&
      (
        keepIds.has(item.relationship.from) ||
        keepIds.has(item.relationship.to)
      )
    )
  );

}

function findSharedEntities(
  groups: DocumentEvidenceGroup[]
): SharedEntityRef[] {

  const occurrence =
    new Map<string, SharedEntityRef>();

  for (const group of groups) {
    for (const entity of group.entities) {
      const existing =
        occurrence.get(entity.id);

      if (!existing) {
        occurrence.set(entity.id, {
          id: entity.id,
          label: entity.label,
          type: entity.type,
          documents: [group.documentId]
        });
        continue;
      }

      if (!existing.documents.includes(group.documentId)) {
        existing.documents.push(group.documentId);
      }
    }
  }

  return [...occurrence.values()]
    .filter(item => item.documents.length > 1)
    .sort((left, right) => left.id.localeCompare(right.id));

}

/**
 * Deterministic grounded summarization / cross-document synthesis.
 */
export function executeSummarization(
  spec: SummarizationSpec,
  evidence: Evidence[],
  options?: {
    query?: string;
    includeAnalyticalCount?: boolean;
  }
): SummarizationResult {

  const scope =
    spec.scope || "current grounded corpus";

  const filtered =
    filterEvidenceForTopics(evidence, spec);

  if (filtered.length === 0) {
    return {
      mode: spec.mode,
      requestedMode: spec.mode,
      status:
        evidence.length === 0
          ? "INSUFFICIENT_EVIDENCE"
          : "NOT_SUPPORTED",
      scope,
      groups: [],
      documentCount: 0,
      sharedEntities: [],
      crossDocumentRelations: [],
      claims: [],
      unsupportedGaps: [
        evidence.length === 0
          ? "No grounded evidence available for summarization."
          : "No grounded evidence matched the requested summarization topics/filters."
      ],
      differences: [],
      explanation:
        evidence.length === 0
          ? "Insufficient grounded evidence for summarization."
          : "Retrieved evidence did not match the requested summarization filters."
    };
  }

  const groups =
    groupEvidenceByDocument(filtered);

  const documentCount =
    groups.length;

  const sharedEntities =
    findSharedEntities(groups);

  const claims: SynthesisClaim[] = [];
  const unsupportedGaps: string[] = [];
  const differences: string[] = [];
  const crossDocumentRelations: Array<{
    description: string;
    grounded: boolean;
  }> = [];

  for (const group of groups) {
    for (const fact of group.facts) {
      claims.push({
        text: `[${group.documentId}] ${fact}`,
        status: "SUPPORTED",
        evidenceEntityIds: group.entities.map(entity => entity.id),
        sourceDocuments: [group.documentId]
      });
    }
  }

  for (const shared of sharedEntities) {
    claims.push({
      text:
        `Shared entity ${shared.label} (${shared.id}) appears in ` +
        `${shared.documents.join(", ")}.`,
      status: "SUPPORTED",
      evidenceEntityIds: [shared.id],
      sourceDocuments: shared.documents
    });

    crossDocumentRelations.push({
      description:
        `Shared concept ${shared.label} across ${shared.documents.join(" and ")} ` +
        `(not a synthetic document-to-document edge).`,
      grounded: true
    });
  }

  /*
   * Never invent chronology/causality from PEP numbering alone.
   */
  if (
    /\bevolv|led to|caused|resulted in|directly led\b/i.test(
      options?.query ?? ""
    )
  ) {
    unsupportedGaps.push(
      "Chronology/causal evolution between PEPs is not established by grounded evidence; PEP numbering alone is not used as proof."
    );
  }

  let mode: SummarizationMode =
    documentCount <= 1
      ? "SINGLE_DOCUMENT_SUMMARY"
      : "CROSS_DOCUMENT_SYNTHESIS";

  let status: SummarizationStatus =
    "SUPPORTED";

  if (
    spec.requiresCrossDocument &&
    documentCount < 2
  ) {
    mode = "SINGLE_DOCUMENT_SUMMARY";
    status = "PARTIALLY_SUPPORTED";
    unsupportedGaps.push(
      "Cross-document synthesis was requested, but only one grounded source document was available."
    );
  }

  if (
    groups.length >= 2 &&
    sharedEntities.length === 0 &&
    spec.topics.length > 0
  ) {
    differences.push(
      "Multiple documents matched topic filters without sharing a canonical entity."
    );
  }

  let analytical: AnalyticalResult | undefined;

  if (
    options?.includeAnalyticalCount ||
    /\bhow many\b|\bcount\b/i.test(options?.query ?? "")
  ) {
    const countSpec = {
      operation: "COUNT" as const,
      target: "PEPs",
      subjectEntityType: "Proposal",
      filter: {
        entityType: "Proposal",
        ...(spec.relationshipFilters[0]
          ? { relationshipType: spec.relationshipFilters[0] }
          : {}),
        ...(spec.topics[0]
          ? { relatedEntityPhrase: spec.topics[0] }
          : {})
      },
      scope
    };

    analytical =
      executeAnalytical(countSpec, filtered);

    if (
      analytical.status === "SUPPORTED" &&
      typeof analytical.value === "number"
    ) {
      claims.push({
        text:
          `Analytical COUNT of distinct PEPs in ${scope}: ${analytical.value} ` +
          `[${analytical.deduplicatedEntityIds.join(", ")}].`,
        status: "SUPPORTED",
        evidenceEntityIds: analytical.deduplicatedEntityIds,
        sourceDocuments: [
          ...new Set(
            analytical.matchedEntities.map(item => {
              const group =
                groups.find(entry =>
                  entry.entities.some(entity =>
                    entity.id === item.entityId
                  )
                );

              return group?.documentId ?? "unknown";
            })
          )
        ]
      });
    }
  }

  /*
   * Detect differing relationship sets across documents (attribution only).
   */
  if (groups.length >= 2) {
    const relSets =
      groups.map(group => ({
        documentId: group.documentId,
        types: [...new Set(group.relationships.map(item => item.type))].sort()
      }));

    for (let index = 1; index < relSets.length; index += 1) {
      const previous =
        relSets[index - 1];
      const current =
        relSets[index];

      if (
        previous.types.join("|") !== current.types.join("|")
      ) {
        differences.push(
          `${previous.documentId} relationships [${previous.types.join(", ") || "none"}] ` +
          `differ from ${current.documentId} [${current.types.join(", ") || "none"}].`
        );
      }
    }
  }

  void detectFocusRelationships;

  const explanation =
    status === "PARTIALLY_SUPPORTED"
      ? `Partial summarization over ${documentCount} document(s) in ${scope}.`
      : `Grounded ${mode === "CROSS_DOCUMENT_SYNTHESIS" ? "cross-document" : "single-document"} ` +
        `summary over ${documentCount} document(s) in ${scope}.`;

  return {
    mode,
    requestedMode: spec.mode,
    status,
    scope,
    groups,
    documentCount,
    sharedEntities,
    crossDocumentRelations,
    claims,
    unsupportedGaps,
    differences,
    ...(analytical ? { analytical } : {}),
    explanation
  };

}

/**
 * Deterministic prose from grounded synthesis (no LLM calculation).
 */
export function formatSummarizationAnswer(
  result: SummarizationResult
): string {

  if (
    result.status === "NOT_SUPPORTED" ||
    result.status === "INSUFFICIENT_EVIDENCE"
  ) {
    return (
      `Summarization: ${result.status}. ${result.explanation} ` +
      `Scope: ${result.scope}.`
    );
  }

  const lines: string[] = [];

  lines.push(
    `Within the available corpus (${result.scope}), ` +
    `${result.mode === "CROSS_DOCUMENT_SYNTHESIS"
      ? "cross-document synthesis"
      : "document summary"} ` +
    `covers ${result.documentCount} source document(s).`
  );

  for (const group of result.groups) {
    lines.push(`Document ${group.documentId}:`);

    for (const fact of group.facts) {
      lines.push(`- ${fact}`);
    }
  }

  if (result.sharedEntities.length > 0) {
    lines.push("Shared concepts across documents:");

    for (const shared of result.sharedEntities) {
      lines.push(
        `- ${shared.label} (${shared.id}) in ${shared.documents.join(", ")}`
      );
    }
  }

  if (result.crossDocumentRelations.length > 0) {
    lines.push("Grounded cross-document notes:");

    for (const relation of result.crossDocumentRelations) {
      lines.push(`- ${relation.description}`);
    }
  }

  if (result.differences.length > 0) {
    lines.push("Document differences (attributed, not merged):");

    for (const difference of result.differences) {
      lines.push(`- ${difference}`);
    }
  }

  if (result.analytical && typeof result.analytical.value === "number") {
    lines.push(
      `Analytical COUNT (deterministic): ${result.analytical.value} ` +
      `[${result.analytical.deduplicatedEntityIds.join(", ")}].`
    );
  }

  if (result.unsupportedGaps.length > 0) {
    lines.push("Unsupported gaps:");

    for (const gap of result.unsupportedGaps) {
      lines.push(`- ${gap}`);
    }
  }

  return lines.join("\n");

}

/**
 * Trace line for summarization execution.
 */
export function formatSummarizationTraceStep(
  result: SummarizationResult
): string {

  return (
    `Summarization: mode=${result.mode} status=${result.status} ` +
    `documents=${result.documentCount} ` +
    `docs=[${result.groups.map(group => group.documentId).join(",")}] ` +
    `claims=${result.claims.filter(claim => claim.status === "SUPPORTED").length} ` +
    `gaps=${result.unsupportedGaps.length} scope=${result.scope}`
  );

}

/**
 * Detect when generated prose invents facts beyond the synthesis.
 */
export function detectSummarizationContradiction(
  answer: string,
  result: SummarizationResult
): string | undefined {

  const groundedDocs =
    new Set(
      result.groups.map(group => group.documentId.toLowerCase())
    );

  const groundedEntityKeys =
    new Set(
      result.groups
        .flatMap(group => group.entities)
        .flatMap(entity => [
          entity.id.toLowerCase().replace(/[\s_-]/g, ""),
          entity.label.toLowerCase().replace(/[\s_-]/g, "")
        ])
    );

  for (const match of answer.matchAll(/\b(pep-?\d+\.md)\b/gi)) {
    const doc =
      match[1].toLowerCase();

    if (
      groundedDocs.size > 0 &&
      ![...groundedDocs].some(item =>
        item.includes(doc.replace(/\.md$/, "")) ||
        doc.includes(item.replace(/\.md$/, ""))
      )
    ) {
      return `Answer invents document ${match[1]} not present in grounded synthesis`;
    }
  }

  for (const match of answer.matchAll(/\bPEP[\s_-]?(\d+)\b/gi)) {
    const pepKey =
      `pep${match[1]}`;

    const grounded =
      [...groundedEntityKeys].some(key => key.includes(pepKey));

    if (!grounded && result.documentCount > 0) {
      return `Answer invents PEP-${match[1]} not present in grounded synthesis`;
    }
  }

  if (
    /\b(?:led to|caused|directly led|resulted in)\b/i.test(answer) &&
    !result.claims.some(claim =>
      /led to|caused|RESULTS_IN/i.test(claim.text)
    )
  ) {
    return "Answer invents unsupported causality between documents";
  }

  if (
    /\b(?:evolved into|then became|chronologically followed|chronological(?:ly)?)\b/i
      .test(answer) &&
    !result.claims.some(claim =>
      /chronolog|evolved into|RESULTS_IN/i.test(claim.text)
    )
  ) {
    return "Answer invents unsupported chronology/evolution";
  }

  if (
    /\bentire Python ecosystem|all PEPs ever|globally\b/i.test(answer)
  ) {
    return "Answer expands beyond current grounded corpus scope";
  }

  if (
    result.analytical &&
    typeof result.analytical.value === "number"
  ) {
    const numbers =
      [...answer.matchAll(/\b(\d+)\b/g)]
        .map(match => Number(match[1]))
        .filter(value => Number.isFinite(value));

    if (
      numbers.length > 0 &&
      numbers.every(value => value !== result.analytical!.value) &&
      /\b(?:count|peps?|documents?)\b/i.test(answer)
    ) {
      return (
        `Answer count contradicts analytical COUNT=${result.analytical.value}`
      );
    }
  }

  return undefined;

}
