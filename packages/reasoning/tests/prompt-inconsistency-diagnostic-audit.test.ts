import {
  createHash
} from "node:crypto";

import {
  describe,
  expect,
  it
} from "vitest";

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
  selectAnswerEvidence
} from "../src/utils/select-answer-evidence.js";

import {
  interpretEvidencePaths
} from "../src/utils/interpret-path.js";

import {
  relationshipAttributionIsGrounded
} from "../src/utils/relationship-attribution.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

/**
 * Diagnostic audit (no production behavior change).
 *
 * Proves that for fixed evidence, stages 1–6 are deterministic across
 * repeated runs, and that observed SUPPORTED vs NOT_SUPPORTED flips are
 * caused by generated answer form / evidence shape interactions — not by
 * unstable query understanding, path topology, or answerEvidence selection.
 */

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
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

function ctx(
  query: string,
  bag: Evidence[]
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
        : {})
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

function verify(
  answer: string,
  context: ReasoningContext
) {
  return new DefaultAnswerVerifier().verify({
    result: {
      answer,
      confidence: 0.9,
      citations: [],
      trace: { steps: [] }
    },
    context
  });
}

const pep484 =
  entity("proposal:PEP-484", "Proposal", "Type Hints", {
    pep: "484",
    title: "Type Hints"
  });

const typing =
  entity("feature:typing", "Feature", "Typing");

const introduces =
  rel(pep484.id, typing.id, "INTRODUCES");

const subjectKeyedBag: Evidence[] = [
  evidenceOf(pep484, introduces, 0.99),
  evidenceOf(typing, introduces, 0.9),
  evidenceOf(pep484),
  evidenceOf(typing)
];

const objectKeyedBag: Evidence[] = [
  evidenceOf(typing, introduces, 0.99)
];

describe("diagnostic: verification inconsistency audit", () => {

  it("stages 1–6 are deterministic across 10 identical runs", () => {
    const query =
      "What did PEP-484 introduce?";

    const fingerprints =
      Array.from({ length: 10 }, () => {
        const context =
          ctx(query, subjectKeyedBag);

        return fingerprint({
          intent: context.understanding?.intent,
          entities: context.understanding?.entities,
          claims: context.understanding?.claims,
          requireTypedEdge:
            context.understanding?.requireTypedEdge,
          evidence: context.evidence.map(item => ({
            id: item.entity.id,
            label: item.entity.label,
            rel: item.relationship
              ? `${item.relationship.from}|${item.relationship.type}|${item.relationship.to}`
              : null
          })),
          path: interpretEvidencePaths(
            query,
            context,
            context.understanding
          ),
          structured: {
            mode: context.answerContext?.mode,
            subjects: context.answerContext?.focusSubjects,
            predicates:
              context.answerContext?.requestedPredicates
          }
        });
      });

    expect(new Set(fingerprints).size).toBe(1);
  });

  it("object-only typed-edge answers do not vacuous-pass attribution", () => {
    const query =
      "What did PEP-484 introduce?";

    const context =
      ctx(query, objectKeyedBag);

    const full =
      verify("Type Hints introduced Typing.", context);

    const short =
      verify("Typing", context);

    /*
     * Object-keyed bags lack subject identity/aliases, so full alias wording
     * cannot resolve — and object-only "Typing" must not vacuous-pass.
     */
    expect(
      relationshipAttributionIsGrounded("Typing", context)
    ).toBe(false);

    expect(short.result.trace.meta?.verificationStatus)
      .not.toBe("SUPPORTED");

    expect(full.result.confidence).toBe(0);
  });

  it("valid object-phrase normalization is accepted for the same bound edge", () => {
    const query =
      "What did PEP-484 introduce?";

    const context =
      ctx(query, subjectKeyedBag);

    const clean =
      verify("PEP-484 introduces Typing.", context);

    const withFeatureSuffix =
      verify(
        "PEP-484 introduces the Typing feature.",
        context
      );

    expect(
      relationshipAttributionIsGrounded(
        "PEP-484 introduces Typing.",
        context
      )
    ).toBe(true);

    expect(
      relationshipAttributionIsGrounded(
        "PEP-484 introduces the Typing feature.",
        context
      )
    ).toBe(true);

    expect(clean.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");

    expect(
      withFeatureSuffix.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
  });

  it("connected intent accepts canonical subject aliases for DIRECT paths", () => {
    const query =
      "How is PEP-484 connected to Typing?";

    const context =
      ctx(query, subjectKeyedBag);

    const path =
      interpretEvidencePaths(
        query,
        context,
        context.understanding
      );

    expect(path.kind).toBe("DIRECT");
    expect(path.supportsClaim).toBe(true);

    const labelOnly =
      verify("Type Hints introduced Typing.", context);

    const canonical =
      verify("PEP-484 introduces Typing.", context);

    expect(
      labelOnly.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");

    expect(
      canonical.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
  });

  it("direct relationship query remains stable for equivalent grounded forms", () => {
    const pep526 =
      entity("proposal:PEP-526", "Proposal", "Variable Annotations", {
        pep: "526",
        title: "Variable Annotations"
      });

    const edge =
      rel(pep526.id, typing.id, "INTRODUCES");

    const bag = [
      evidenceOf(pep526, edge, 0.99),
      evidenceOf(typing, edge, 0.9),
      evidenceOf(pep526),
      evidenceOf(typing)
    ];

    const query =
      "What is the direct relationship between PEP-526 and Typing?";

    const context =
      ctx(query, bag);

    const a =
      verify("Variable Annotations introduced Typing.", context);

    const b =
      verify("PEP-526 introduced Typing.", context);

    expect(a.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");

    expect(b.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

});
