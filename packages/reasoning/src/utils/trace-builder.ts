import type {
  Evidence,
  EvidenceSet,
  ReasoningTrace,
  ReasoningStep
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import {
  evaluateLogicalImplication,
  formatImplicationTraceStep
} from "./logical-implication.js";

import {
  formatIntentTraceStep,
  understandQuery,
  type QueryUnderstanding
} from "./query-understanding.js";

import {
  interpretEvidencePaths,
  formatPathInterpretationTraceStep,
  toPathInterpretationSummary,
  type PathInterpretation
} from "./interpret-path.js";

import {
  calibrateFromContext,
  formatConfidenceTraceStep,
  type CalibratedConfidence
} from "./calibrate-confidence.js";

import {
  classifyRelationalSupport
} from "./classify-relational-support.js";

import type {
  AnswerSupportStatus
} from "./answer-intent-verification.js";

import {
  formatAnalyticalTraceStep
} from "./execute-analytical.js";

import {
  formatSummarizationTraceStep
} from "./execute-summarization.js";

export interface BuildTraceOptions {
  query?: string;
  context?: ReasoningContext;
  understanding?: QueryUnderstanding;
  pathInterpretation?: PathInterpretation;
  calibratedConfidence?: CalibratedConfidence;
  verificationStatus?: AnswerSupportStatus;
  /**
   * When false, skip path/confidence enrichment (legacy callers).
   * Default true when context/query present.
   */
  enrich?: boolean;
}

/**
 * Build a reasoning-path trace from evidence.
 *
 * Co-seeded endpoints that carry the same underlying relationship
 * (from|type|to) produce one path step — not one step per attachment.
 * Direction and provenance of the preferred attachment are preserved.
 *
 * P5: optionally records path interpretation + calibrated confidence.
 */
export function buildTrace(
  evidenceSet: EvidenceSet,
  options?: BuildTraceOptions
): ReasoningTrace {

  const steps: ReasoningStep[] = [];

  const seenRelationships =
    new Set<string>();

  const entitiesCoveredByRelationship =
    new Set<string>();

  const seenEntityOnly =
    new Set<string>();

  const labelById =
    buildLabelIndex(evidenceSet.evidence);

  for (const item of evidenceSet.evidence) {

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    const key =
      `${relationship.from}|${relationship.type}|${relationship.to}`;

    if (seenRelationships.has(key)) {
      continue;
    }

    seenRelationships.add(key);
    entitiesCoveredByRelationship.add(relationship.from);
    entitiesCoveredByRelationship.add(relationship.to);

    const preferred =
      preferSourceAttachment(
        evidenceSet.evidence,
        relationship.from,
        relationship.to,
        key
      ) ?? item;

    const fromLabel =
      labelById.get(relationship.from) ??
      relationship.from;

    const toLabel =
      labelById.get(relationship.to) ??
      relationship.to;

    const fromType =
      preferred.entity.id === relationship.from
        ? preferred.entity.type
        : inferType(labelById, relationship.from);

    steps.push({
      description:
        `Selected ${fromType}: ${fromLabel} via ${relationship.type} (${relationship.from} → ${relationship.to})`,
      evidence: [preferred]
    });

  }

  for (const item of evidenceSet.evidence) {

    if (item.relationship) {
      continue;
    }

    if (entitiesCoveredByRelationship.has(item.entity.id)) {
      continue;
    }

    if (seenEntityOnly.has(item.entity.id)) {
      continue;
    }

    seenEntityOnly.add(item.entity.id);

    steps.push({
      description:
        `Selected ${item.entity.type}: ${item.entity.label}`,
      evidence: [item]
    });

  }

  const query =
    options?.query ??
    options?.context?.query;

  const understanding =
    options?.understanding ??
    options?.context?.understanding ??
    (query ? understandQuery(query) : undefined);

  if (understanding) {
    steps.unshift({
      description: formatIntentTraceStep(understanding),
      evidence: []
    });
  }

  const enrich =
    options?.enrich !== false &&
    Boolean(options?.context || query);

  let pathInterpretation =
    options?.pathInterpretation;

  let calibrated =
    options?.calibratedConfidence;

  let verificationStatus =
    options?.verificationStatus;

  if (enrich && options?.context && query) {
    if (!pathInterpretation) {
      pathInterpretation =
        interpretEvidencePaths(
          query,
          options.context,
          understanding
        );
    }

    const implication =
      evaluateLogicalImplication(
        query,
        options.context
      );

    const relational =
      classifyRelationalSupport(
        query,
        options.context
      );

    if (!calibrated) {
      calibrated =
        calibrateFromContext(options.context, {
          pathInterpretation,
          intent: understanding?.intent,
          implicationSupport: implication.support,
          relationalKind: relational.kind,
          verificationStatus,
          analyticalStatus:
            options.context.analyticalResult?.status,
          summarizationStatus:
            options.context.summarizationResult?.status
        });
    }

    if (
      implication.support !== "NOT_APPLICABLE"
    ) {
      const implicationStep =
        formatImplicationTraceStep(implication);

      if (implicationStep) {
        steps.push({
          description: implicationStep,
          evidence: []
        });
      }
    }
  } else if (query) {
    const decision =
      evaluateLogicalImplication(
        query,
        options?.context ?? {
          query,
          items: [],
          evidence: evidenceSet.evidence,
          budget: {
            maxEvidence: evidenceSet.evidence.length,
            inputCount: evidenceSet.evidence.length,
            retainedCount: evidenceSet.evidence.length,
            truncated: false
          },
          config: {
            maxEvidence: evidenceSet.evidence.length
          }
        }
      );

    const implicationStep =
      formatImplicationTraceStep(decision);

    if (implicationStep) {
      steps.push({
        description: implicationStep,
        evidence: []
      });
    }
  }

  const analyticalResult =
    options?.context?.analyticalResult;

  if (analyticalResult) {
    const line =
      formatAnalyticalTraceStep(analyticalResult);

    if (!steps.some(step => step.description === line)) {
      steps.push({
        description: line,
        evidence: analyticalResult.evidence.slice(0, 3)
      });
    }
  }

  const summarizationResult =
    options?.context?.summarizationResult;

  if (summarizationResult) {
    const line =
      formatSummarizationTraceStep(summarizationResult);

    if (!steps.some(step => step.description === line)) {
      steps.push({
        description: line,
        evidence: []
      });
    }
  }

  if (pathInterpretation) {
    const line =
      formatPathInterpretationTraceStep(pathInterpretation);

    if (!steps.some(step => step.description === line)) {
      steps.push({
        description: line,
        evidence: []
      });
    }
  }

  if (calibrated) {
    const line =
      formatConfidenceTraceStep(calibrated);

    if (!steps.some(step => step.description === line)) {
      steps.push({
        description: line,
        evidence: []
      });
    }
  }

  const trace: ReasoningTrace = {
    steps
  };

  if (
    understanding ||
    pathInterpretation ||
    calibrated ||
    verificationStatus ||
    analyticalResult ||
    summarizationResult
  ) {
    trace.meta = {
      ...(understanding
        ? { intent: understanding.intent }
        : {}),
      ...(pathInterpretation
        ? {
            pathInterpretation:
              toPathInterpretationSummary(pathInterpretation)
          }
        : {}),
      ...(verificationStatus
        ? { verificationStatus }
        : {}),
      ...(analyticalResult
        ? {
            analytical: {
              operation: analyticalResult.operation,
              status: analyticalResult.status,
              ...(analyticalResult.value !== undefined
                ? { value: analyticalResult.value }
                : {}),
              subject: analyticalResult.subject,
              scope: analyticalResult.scope,
              deduplicatedEntityIds:
                analyticalResult.deduplicatedEntityIds,
              matchedEntityIds:
                analyticalResult.matchedEntities.map(
                  item => item.entityId
                ),
              filters: {
                relationshipType:
                  analyticalResult.filters?.relationshipType,
                relatedEntityPhrase:
                  analyticalResult.filters?.relatedEntityPhrase,
                entityType:
                  analyticalResult.filters?.entityType
              },
              explanation: analyticalResult.explanation
            }
          }
        : {}),
      ...(summarizationResult
        ? {
            summarization: {
              mode: summarizationResult.mode,
              requestedMode: summarizationResult.requestedMode,
              status: summarizationResult.status,
              scope: summarizationResult.scope,
              documentCount: summarizationResult.documentCount,
              documents: summarizationResult.groups.map(
                group => group.documentId
              ),
              sharedEntityIds:
                summarizationResult.sharedEntities.map(
                  item => item.id
                ),
              supportedClaimCount:
                summarizationResult.claims.filter(
                  claim => claim.status === "SUPPORTED"
                ).length,
              unsupportedGaps:
                summarizationResult.unsupportedGaps,
              explanation: summarizationResult.explanation
            }
          }
        : {}),
      ...(calibrated
        ? {
            confidence: {
              score: calibrated.score,
              level: calibrated.level,
              reasons: calibrated.reasons
            }
          }
        : {})
    };
  }

  return trace;

}

function buildLabelIndex(
  evidence: Evidence[]
): Map<string, string> {

  const labels =
    new Map<string, string>();

  for (const item of evidence) {
    if (!labels.has(item.entity.id)) {
      labels.set(item.entity.id, item.entity.label);
    }

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    if (
      item.entity.id === relationship.from &&
      !labels.has(relationship.from)
    ) {
      labels.set(relationship.from, item.entity.label);
    }

    if (
      item.entity.id === relationship.to &&
      !labels.has(relationship.to)
    ) {
      labels.set(relationship.to, item.entity.label);
    }
  }

  return labels;

}

function preferSourceAttachment(
  evidence: Evidence[],
  fromId: string,
  toId: string,
  relationshipKey: string
): Evidence | undefined {

  const matching =
    evidence.filter(item => {
      const relationship =
        item.relationship;

      if (!relationship) {
        return false;
      }

      return (
        `${relationship.from}|${relationship.type}|${relationship.to}` ===
        relationshipKey
      );
    });

  return (
    matching.find(item => item.entity.id === fromId) ??
    matching.find(item => item.entity.id === toId) ??
    matching[0]
  );

}

function inferType(
  _labelById: Map<string, string>,
  entityId: string
): string {

  const prefix =
    entityId.split(":")[0];

  if (!prefix) {
    return "Entity";
  }

  return prefix.charAt(0).toUpperCase() + prefix.slice(1);

}
