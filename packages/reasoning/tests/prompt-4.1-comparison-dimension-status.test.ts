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
  detectComparisonDimensions,
  detectComparisonRequest,
  relationshipTypesForDimensions
} from "../src/utils/detect-comparison-request.js";

import {
  buildStructuredComparison
} from "../src/utils/compare-evidence.js";

import {
  renderStructuredComparison
} from "../src/utils/render-comparison.js";

import {
  interpretEvidencePaths
} from "../src/utils/interpret-path.js";

import {
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

function entity(
  id: string,
  type: string,
  label: string
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "fixture.md",
    confidence: 1,
    properties: {}
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
  relationship?: KnowledgeRelationship
): Evidence {
  return {
    entity: node,
    score: 0.95,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 5 + 2) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ctx(
  query: string,
  evidence: Evidence[],
  comparison?: string
): ReasoningContext {
  const understanding =
    understandQuery(query);

  return {
    query,
    understanding,
    evidence,
    items: evidence.map(item => ({
      entityId: item.entity.id,
      entityType: item.entity.type,
      label: item.entity.label,
      source: item.entity.source,
      score: item.score,
      properties: item.entity.properties ?? {},
      ...(item.relationship
        ? { relationship: item.relationship }
        : {})
    })),
    budget: {
      maxEvidence: 50,
      inputCount: evidence.length,
      retainedCount: evidence.length,
      truncated: false
    },
    config: { maxEvidence: 50 },
    ...(comparison ? { comparison } : {})
  };
}

describe("Prompt 4.1 comparison dimension/status/path fixes", () => {

  const A =
    entity("proposal:a", "Proposal", "EntityA");
  const B =
    entity("proposal:b", "Proposal", "EntityB");
  const C =
    entity("proposal:c", "Proposal", "EntityC");
  const D =
    entity("proposal:d", "Proposal", "EntityD");
  const featX =
    entity("feature:x", "Feature", "FeatureX");
  const featY =
    entity("feature:y", "Feature", "FeatureY");
  const concern =
    entity("concern:r", "Concern", "Readability");
  const author =
    entity("author:p", "Author", "AuthorP");
  const decision =
    entity("decision:f", "Decision", "Final");
  const missing =
    entity("feature:missing", "Feature", "DistributedComputing");

  const aIntro =
    rel(A.id, featX.id, "INTRODUCES");
  const bIntro =
    rel(B.id, featY.id, "INTRODUCES");
  const aProposed =
    rel(A.id, author.id, "PROPOSED_BY");
  const bProposed =
    rel(B.id, author.id, "PROPOSED_BY");
  const aDecision =
    rel(A.id, decision.id, "RESULTS_IN");
  const aAddresses =
    rel(A.id, concern.id, "ADDRESSES");
  const bAddresses =
    rel(B.id, concern.id, "ADDRESSES");
  const cIntro =
    rel(C.id, featX.id, "INTRODUCES");
  const dIntro =
    rel(D.id, featY.id, "INTRODUCES");

  it("A: explicit dimensions exclude ADDRESSES leakage", () => {
    const query =
      "Compare EntityA, EntityB, EntityC, and EntityD based only on relationships; what each introduces, who proposed it, and decision?";

    const request =
      detectComparisonRequest(query, [
        "EntityA",
        "EntityB",
        "EntityC",
        "EntityD"
      ]);

    expect(request?.subjects).toHaveLength(4);
    expect(request?.dimensions).toEqual([
      "introduces",
      "proposed_by",
      "results_in"
    ]);
    expect(request?.dimensions).not.toContain("relationships");
    expect(request?.dimensions).not.toContain("addresses");

    const types =
      relationshipTypesForDimensions(request!.dimensions);

    expect(types?.has("ADDRESSES")).toBe(false);
    expect(types?.has("INTRODUCES")).toBe(true);

    const structured =
      buildStructuredComparison(
        request!,
        [
          evidenceOf(A, aIntro),
          evidenceOf(A, aProposed),
          evidenceOf(A, aDecision),
          evidenceOf(A, aAddresses),
          evidenceOf(B, bIntro),
          evidenceOf(B, bProposed),
          evidenceOf(B, bAddresses),
          evidenceOf(C, cIntro),
          evidenceOf(D, dIntro),
          evidenceOf(concern),
          evidenceOf(featX),
          evidenceOf(featY)
        ]
      );

    const rendered =
      renderStructuredComparison(structured);

    expect(rendered).not.toMatch(/addresses/i);
    expect(
      structured.common.some(fact => fact.type === "ADDRESSES")
    ).toBe(false);
    expect(
      structured.perSubject.some(item =>
        item.relationships.some(fact => fact.type === "ADDRESSES")
      )
    ).toBe(false);
  });

  it("B: relationship-only without specifics remains valid", () => {
    const query =
      "Compare EntityA and EntityB based only on their relationships.";

    const dims =
      detectComparisonDimensions(query);

    expect(dims.dimensions).toEqual(["relationships"]);
    expect(
      relationshipTypesForDimensions(dims.dimensions)?.has("ADDRESSES")
    ).toBe(true);
  });

  it("C: unsupported subject stays PARTIALLY_SUPPORTED — never SUPPORTED", () => {
    const query =
      "Compare EntityA and DistributedComputing based on relationships.";

    const evidence = [
      evidenceOf(A, aIntro),
      evidenceOf(featX),
      evidenceOf(missing)
    ];

    const request =
      detectComparisonRequest(query, [
        "EntityA",
        "DistributedComputing"
      ]);

    const structured =
      buildStructuredComparison(request!, evidence);

    expect(structured.unsupportedSubjects).toContain(
      "DistributedComputing"
    );

    const comparison =
      renderStructuredComparison(structured);

    const context =
      ctx(query, evidence, comparison);

    const verification =
      verifyAnswerAgainstIntent(comparison, context);

    expect(verification.semantics.status).toBe(
      "PARTIALLY_SUPPORTED"
    );
    expect(verification.semantics.status).not.toBe("SUPPORTED");

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      verifier.verify({
        result: {
          answer: comparison,
          comparison,
          confidence: 1,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    const statusLines =
      outcome.result.trace.steps
        .map(step => step.description)
        .join("\n");

    expect(statusLines).toMatch(/PARTIALLY_SUPPORTED/i);
    expect(statusLines).not.toMatch(
      /Verification: SUPPORTED — answer accepted/
    );
    expect(outcome.result.confidence).toBeLessThan(1);
    expect(outcome.result.confidenceLevel).not.toBe("HIGH");
  });

  it("D: introduce + proposer only — no addresses/results_in", () => {
    const query =
      "Compare EntityA and EntityB based on what they introduce and who proposed them.";

    const request =
      detectComparisonRequest(query, ["EntityA", "EntityB"]);

    expect(request?.dimensions).toEqual([
      "introduces",
      "proposed_by"
    ]);

    const structured =
      buildStructuredComparison(
        request!,
        [
          evidenceOf(A, aIntro),
          evidenceOf(A, aProposed),
          evidenceOf(A, aDecision),
          evidenceOf(A, aAddresses),
          evidenceOf(B, bIntro),
          evidenceOf(B, bProposed),
          evidenceOf(B, bAddresses)
        ]
      );

    const rendered =
      renderStructuredComparison(structured);

    expect(rendered).not.toMatch(/addresses/i);
    expect(rendered).not.toMatch(/results in/i);
    expect(
      structured.perSubject.flatMap(item =>
        item.relationships.map(fact => fact.type)
      )
    ).toEqual(
      expect.arrayContaining(["INTRODUCES", "PROPOSED_BY"])
    );
  });

  it("E: proposer-only scope", () => {
    const query =
      "Compare EntityA and EntityB based only on who proposed them.";

    expect(
      detectComparisonDimensions(query).dimensions
    ).toEqual(["proposed_by"]);
  });

  it("F: introduce-only scope", () => {
    const query =
      "Compare EntityA and EntityB based on the features they introduce.";

    expect(
      detectComparisonDimensions(query).dimensions
    ).toEqual(["introduces"]);
  });

  it("G: permutation does not change filtered comparison", () => {
    const request = {
      subjects: ["EntityA", "EntityB"],
      dimensions: ["introduces" as const],
      relationshipsOnly: true
    };

    const base = [
      evidenceOf(A, aIntro),
      evidenceOf(A, aAddresses),
      evidenceOf(B, bIntro),
      evidenceOf(B, bAddresses),
      evidenceOf(concern)
    ];

    const first =
      buildStructuredComparison(request, base);
    const second =
      buildStructuredComparison(request, shuffle(base));

    expect(
      second.perSubject.map(item => ({
        subject: item.subject,
        keys: item.relationships.map(fact => fact.key).sort()
      }))
    ).toEqual(
      first.perSubject.map(item => ({
        subject: item.subject,
        keys: item.relationships.map(fact => fact.key).sort()
      }))
    );

    expect(
      renderStructuredComparison(second)
    ).not.toMatch(/addresses/i);
  });

  it("H: unsupported dimension yields PARTIAL/NOT_SUPPORTED", () => {
    const query =
      "Compare EntityA and EntityB based only on who proposed them.";

    const request =
      detectComparisonRequest(query, ["EntityA", "EntityB"])!;

    const structured =
      buildStructuredComparison(
        request,
        [
          evidenceOf(A, aIntro),
          evidenceOf(B, bIntro)
        ]
      );

    expect(structured.unsupportedSubjects).toEqual([
      "EntityA",
      "EntityB"
    ]);

    const comparison =
      renderStructuredComparison(structured);

    const verification =
      verifyAnswerAgainstIntent(
        comparison,
        ctx(query, [
          evidenceOf(A, aIntro),
          evidenceOf(B, bIntro)
        ], comparison)
      );

    expect(
      ["PARTIALLY_SUPPORTED", "NOT_SUPPORTED"]
    ).toContain(verification.semantics.status);
  });

  it("I: unrequested relationship evidence excluded from result", () => {
    const structured =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["introduces"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntro),
          evidenceOf(A, aAddresses),
          evidenceOf(B, bIntro),
          evidenceOf(B, bAddresses)
        ]
      );

    expect(
      structured.perSubject.flatMap(item =>
        item.relationships.map(fact => fact.type)
      )
    ).toEqual(["INTRODUCES", "INTRODUCES"]);
  });

  it("J: comparison trace is COMPARISON_EVIDENCE — not MULTI_HOP", () => {
    const query =
      "Compare EntityA and EntityB based only on relationships.";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aIntro),
          evidenceOf(B, bIntro),
          evidenceOf(A, aAddresses),
          evidenceOf(B, bAddresses)
        ])
      );

    expect(interpretation.kind).toBe("COMPARISON_EVIDENCE");
    expect(interpretation.hopCount).toBe(0);
    expect(interpretation.supportsClaim).toBe(false);
    expect(["DIRECT", "CONNECTED", "BRIDGE", "MULTI_HOP"])
      .not.toContain(interpretation.kind);
  });

  it("K: production-style partial subject never upgrades via verifier accept path", () => {
    const query =
      "Compare EntityA and DistributedComputing based on relationships.";

    const comparison = [
      "Comparison of EntityA, DistributedComputing (relationships):",
      "EntityA: introduces FeatureX.",
      "DistributedComputing: insufficient evidence for requested dimensions.",
      "Unsupported subjects: DistributedComputing."
    ].join("\n");

    const context =
      ctx(query, [
        evidenceOf(A, aIntro),
        evidenceOf(featX),
        evidenceOf(missing)
      ], comparison);

    const verification =
      verifyAnswerAgainstIntent(comparison, context);

    expect(verification.semantics.status).toBe(
      "PARTIALLY_SUPPORTED"
    );

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer: comparison,
          comparison,
          confidence: 1,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(
      outcome.result.trace.steps.some(step =>
        /PARTIALLY_SUPPORTED/i.test(step.description)
      )
    ).toBe(true);

    expect(
      outcome.result.trace.steps.some(step =>
        step.description ===
          "Verification: SUPPORTED — answer accepted"
      )
    ).toBe(false);
  });

});
