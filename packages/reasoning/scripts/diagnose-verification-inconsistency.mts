/**
 * Diagnostic-only harness (Prompt inconsistency audit).
 * Does not change production behavior.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  buildStructuredAnswerContext,
  deriveAnswerEvidenceScope,
  selectAnswerEvidence
} from "../src/utils/select-answer-evidence.js";

import {
  interpretEvidencePaths
} from "../src/utils/interpret-path.js";

import {
  relationshipAttributionIsGrounded
} from "../src/utils/relationship-attribution.js";

import {
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

function entity(
  id: string,
  type: string,
  label: string,
  properties: Record<string, unknown> = {}
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: `${id}.md`,
    confidence: 1,
    properties
  };
}

function rel(
  from: string,
  to: string,
  type: string
): KnowledgeRelationship {
  return {
    from,
    to,
    type,
    confidence: 1,
    properties: {}
  };
}

function evidenceOf(
  node: KnowledgeEntity,
  relationship?: KnowledgeRelationship,
  score = 0.9
): Evidence {
  return {
    entity: node,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

function fingerprint(
  value: unknown
): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 16);
}

function stableStringify(
  value: unknown
): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    const record =
      value as Record<string, unknown>;

    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map(key => [key, sortKeys(record[key])])
    );
  }

  return value;
}

function evidenceKeys(
  evidence: Evidence[]
): string[] {
  return evidence.map(item =>
    item.relationship
      ? `rel:${item.relationship.from}|${item.relationship.type}|${item.relationship.to}@${item.entity.id}`
      : `ent:${item.entity.id}`
  );
}

const pep484 =
  entity("proposal:PEP-484", "Proposal", "Type Hints", {
    pep: "484",
    title: "Type Hints"
  });
const pep526 =
  entity("proposal:PEP-526", "Proposal", "Variable Annotations", {
    pep: "526",
    title: "Variable Annotations"
  });
const pep604 =
  entity("proposal:PEP-604", "Proposal", "Union Syntax", {
    pep: "604",
    title: "Union Syntax"
  });
const typing =
  entity("feature:typing", "Feature", "Typing");
const readability =
  entity("concern:readability", "Concern", "Readability");
const guido =
  entity("author:guido", "Author", "Guido van Rossum");

const corpus: Evidence[] = [
  evidenceOf(pep484, rel(pep484.id, typing.id, "INTRODUCES"), 0.99),
  evidenceOf(pep484, rel(pep484.id, guido.id, "PROPOSED_BY"), 0.98),
  evidenceOf(pep484, rel(pep484.id, readability.id, "ADDRESSES"), 0.97),
  evidenceOf(pep526, rel(pep526.id, typing.id, "INTRODUCES"), 0.96),
  evidenceOf(pep526, rel(pep526.id, guido.id, "PROPOSED_BY"), 0.95),
  evidenceOf(pep604, rel(pep604.id, typing.id, "INTRODUCES"), 0.94),
  evidenceOf(pep484),
  evidenceOf(pep526),
  evidenceOf(pep604),
  evidenceOf(typing),
  evidenceOf(readability),
  evidenceOf(guido),
  evidenceOf(typing, rel(pep484.id, typing.id, "INTRODUCES"), 0.5),
  evidenceOf(typing, rel(pep526.id, typing.id, "INTRODUCES"), 0.49),
  evidenceOf(typing, rel(pep604.id, typing.id, "INTRODUCES"), 0.48)
];

function buildContext(
  query: string,
  bag: Evidence[] = corpus
): ReasoningContext {
  const understanding =
    understandQuery(query);

  const selected =
    selectAnswerEvidence(understanding, bag);

  return {
    query,
    understanding,
    answerContext:
      buildStructuredAnswerContext(understanding, selected),
    evidence: selected,
    items: selected.map(item => ({
      entityId: item.entity.id,
      entityType: item.entity.type,
      label: item.entity.label,
      source: item.entity.source,
      confidence: item.entity.confidence,
      score: item.score,
      evidenceSource: item.source,
      properties: item.entity.properties ?? {},
      ...(item.relationship
        ? { relationship: item.relationship }
        : {}),
      ...(item.path ? { path: item.path } : {})
    })),
    budget: {
      maxEvidence: 50,
      inputCount: bag.length,
      retainedCount: selected.length,
      truncated: false
    },
    config: { maxEvidence: 50 }
  };
}

type StageSnap = {
  understanding: unknown;
  scope: unknown;
  answerEvidenceKeys: string[];
  answerEvidenceOrder: string[];
  path: unknown;
  structuredContext: unknown;
  attributionByAnswer: Record<string, boolean>;
  verificationByAnswer: Record<string, {
    status: string | undefined;
    confidence: number;
    reasons: string[];
  }>;
  templateAnswer: string;
};

async function snapshotStages(
  query: string,
  probeAnswers: string[]
): Promise<{
  fingerprints: Record<string, string>;
  snap: StageSnap;
}> {
  const context =
    buildContext(query);

  const understanding =
    context.understanding!;

  const scope =
    deriveAnswerEvidenceScope(understanding);

  const path =
    interpretEvidencePaths(
      query,
      context,
      understanding
    );

  const template =
    await new DefaultAnswerGenerator().generate(context);

  const attributionByAnswer: Record<string, boolean> = {};
  const verificationByAnswer: StageSnap["verificationByAnswer"] = {};

  for (const answer of probeAnswers) {
    attributionByAnswer[answer] =
      relationshipAttributionIsGrounded(answer, context);

    const intent =
      verifyAnswerAgainstIntent(answer, context);

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer,
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    verificationByAnswer[answer] = {
      status:
        String(
          outcome.result.trace.meta?.verificationStatus ??
          intent.semantics.status
        ),
      confidence: outcome.result.confidence,
      reasons: [
        ...intent.semantics.reasons,
        ...outcome.result.trace.steps
          .map(step => step.description)
          .filter(line =>
            /Verification:|attribution|Confidence:/i.test(line)
          )
      ]
    };
  }

  const snap: StageSnap = {
    understanding: {
      intent: understanding.intent,
      entities: understanding.entities,
      relationshipRequested: understanding.relationshipRequested,
      relationshipMode: understanding.relationshipMode,
      claims: understanding.claims,
      requireTypedEdge: understanding.requireTypedEdge,
      requireRelationshipBetween:
        understanding.requireRelationshipBetween,
      bridgeEntity: understanding.bridgeEntity,
      strategy: understanding.strategy,
      maxDepth: understanding.maxDepth
    },
    scope,
    answerEvidenceKeys:
      evidenceKeys(context.evidence).slice().sort(),
    answerEvidenceOrder:
      evidenceKeys(context.evidence),
    path: {
      kind: path.kind,
      hopCount: path.hopCount,
      supportsClaim: path.supportsClaim,
      relationships: path.relationships,
      explanation: path.explanation
    },
    structuredContext: {
      mode: context.answerContext?.mode,
      focusSubjects: context.answerContext?.focusSubjects,
      focusObjects: context.answerContext?.focusObjects,
      requestedPredicates:
        context.answerContext?.requestedPredicates,
      claimBindings:
        context.answerContext?.claims?.map(claim => ({
          subject: claim.subject,
          predicate: claim.predicate,
          object: claim.object,
          evidenceKeys: evidenceKeys(claim.evidence ?? [])
        })),
      evidenceKeys: evidenceKeys(
        context.answerContext?.answerEvidence ?? context.evidence
      )
    },
    attributionByAnswer,
    verificationByAnswer,
    templateAnswer: template.answer
  };

  return {
    fingerprints: {
      understanding: fingerprint(snap.understanding),
      scope: fingerprint(snap.scope),
      answerEvidenceSorted: fingerprint(snap.answerEvidenceKeys),
      answerEvidenceOrder: fingerprint(snap.answerEvidenceOrder),
      path: fingerprint(snap.path),
      structuredContext: fingerprint(snap.structuredContext),
      templateAnswer: fingerprint(snap.templateAnswer),
      attributionByAnswer: fingerprint(snap.attributionByAnswer),
      verificationByAnswer: fingerprint(snap.verificationByAnswer)
    },
    snap
  };
}

const QUERIES: Array<{
  id: string;
  query: string;
  probeAnswers: string[];
}> = [
  {
    id: "A",
    query: "What did PEP-484 introduce?",
    probeAnswers: [
      "Type Hints introduced Typing.",
      "Typing",
      "PEP-484 introduced Typing.",
      "Type Hints introduced Typing"
    ]
  },
  {
    id: "B",
    query: "How is PEP-484 connected to Typing?",
    probeAnswers: [
      "Type Hints introduced Typing.",
      "PEP-484 introduces the Typing feature.",
      "Typing is connected to Type Hints.",
      "PEP-484 -> INTRODUCES -> Typing"
    ]
  },
  {
    id: "C",
    query: "What is the direct relationship between PEP-526 and Typing?",
    probeAnswers: [
      "Variable Annotations introduced Typing.",
      "PEP-526 introduced Typing.",
      "Typing"
    ]
  },
  {
    id: "D",
    query: "How are PEP-526 and PEP-604 connected through Typing?",
    probeAnswers: [
      "Variable Annotations introduced Typing. Union Syntax introduced Typing.",
      "PEP-526 introduced Typing. PEP-604 introduced Typing.",
      "Both introduced Typing.",
      "Typing connects PEP-526 and PEP-604."
    ]
  },
  {
    id: "E",
    query:
      "Who proposed PEP-484, what did it introduce, and what concern did it address?",
    probeAnswers: [
      "Type Hints was proposed by Guido van Rossum. Type Hints introduced Typing. Type Hints addressed Readability.",
      "PEP-484 was proposed by Guido van Rossum. PEP-484 introduced Typing. PEP-484 addressed Readability.",
      "Guido van Rossum proposed Type Hints."
    ]
  },
  {
    id: "F",
    query: "What did PEP-526 introduce?",
    probeAnswers: [
      "Variable Annotations introduced Typing.",
      "Typing",
      "PEP-526 introduced Typing."
    ]
  }
];

const RUNS = 10;

async function main(): Promise<void> {
  const report: unknown[] = [];

  for (const entry of QUERIES) {
    const runs: Array<{
      run: number;
      fingerprints: Record<string, string>;
      snap: StageSnap;
    }> = [];

    for (let i = 0; i < RUNS; i++) {
      const result =
        await snapshotStages(entry.query, entry.probeAnswers);

      runs.push({
        run: i + 1,
        fingerprints: result.fingerprints,
        snap: result.snap
      });
    }

    const stageNames =
      Object.keys(runs[0].fingerprints);

    const stageStability: Record<string, {
      uniqueCount: number;
      values: string[];
      stable: boolean;
    }> = {};

    for (const stage of stageNames) {
      const values =
        runs.map(run => run.fingerprints[stage]);

      const unique =
        [...new Set(values)];

      stageStability[stage] = {
        uniqueCount: unique.length,
        values: unique,
        stable: unique.length === 1
      };
    }

    const firstDivergentStage =
      stageNames.find(stage => !stageStability[stage].stable) ??
      null;

    const probeDivergence =
      Object.fromEntries(
        entry.probeAnswers.map(answer => {
          const statuses =
            runs.map(run =>
              run.snap.verificationByAnswer[answer]
            );

          const uniqueStatuses =
            [...new Set(statuses.map(item => item.status))];

          const uniqueAttr =
            [...new Set(
              runs.map(run =>
                String(run.snap.attributionByAnswer[answer])
              )
            )];

          return [
            answer,
            {
              attributionValues: uniqueAttr,
              verificationStatuses: uniqueStatuses,
              sample: statuses[0],
              divergesAcrossRuns:
                uniqueStatuses.length > 1 ||
                uniqueAttr.length > 1
            }
          ];
        })
      );

    const answerFormComparison =
      entry.probeAnswers.map(answer => {
        const sample =
          runs[0].snap.verificationByAnswer[answer];

        return {
          answer,
          attribution:
            runs[0].snap.attributionByAnswer[answer],
          status: sample.status,
          confidence: sample.confidence,
          reasons: sample.reasons
        };
      });

    report.push({
      id: entry.id,
      query: entry.query,
      runs: RUNS,
      stageStability,
      firstDivergentStage,
      divergenceClass:
        firstDivergentStage
          ? "non_deterministic_upstream_or_generation"
          : "deterministic_upstream_verification_depends_on_answer_form",
      templateAnswerStable:
        stageStability.templateAnswer.stable,
      templateAnswer:
        runs[0].snap.templateAnswer,
      understanding: runs[0].snap.understanding,
      path: runs[0].snap.path,
      answerEvidenceOrder:
        runs[0].snap.answerEvidenceOrder,
      structuredContext:
        runs[0].snap.structuredContext,
      answerFormComparison,
      probeDivergence
    });
  }

  const outDir =
    path.dirname(fileURLToPath(import.meta.url));

  const outPath =
    path.join(
      outDir,
      "prompt-inconsistency-audit-report.json"
    );

  writeFileSync(
    outPath,
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(`Wrote ${outPath}`);

  for (const item of report as Array<Record<string, unknown>>) {
    console.log("\n====", item.id, item.query);
    console.log("firstDivergentStage:", item.firstDivergentStage);
    console.log("divergenceClass:", item.divergenceClass);
    console.log("templateAnswer:", JSON.stringify(item.templateAnswer));
    console.log(
      "answerFormComparison:",
      JSON.stringify(item.answerFormComparison, null, 2)
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
