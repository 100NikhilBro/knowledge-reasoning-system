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
    source: "fixture.md",
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
  score = 0.95
): Evidence {
  return {
    entity: node,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 19 + 5) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function relationKeys(evidence: Evidence[]): string[] {
  return evidence
    .filter(item => item.relationship)
    .map(item =>
      `${item.relationship!.from}|${item.relationship!.type}|${item.relationship!.to}`
    )
    .sort();
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

describe("Prompt 5.3 compound CLAIM_SET attribution", () => {

  const A =
    entity("proposal:a", "Proposal", "EntityA", {
      pep: "100",
      title: "Alpha Spec"
    });
  const B =
    entity("proposal:b", "Proposal", "EntityB", {
      pep: "200",
      title: "Beta Spec"
    });
  const featX =
    entity("feature:x", "Feature", "FeatureX");
  const concern =
    entity("concern:r", "Concern", "ConcernR");
  const authorA =
    entity("author:a", "Author", "AuthorA");
  const authorB =
    entity("author:b", "Author", "AuthorB");

  const bag: Evidence[] = [
    evidenceOf(A, rel(A.id, authorA.id, "PROPOSED_BY")),
    evidenceOf(A, rel(A.id, featX.id, "INTRODUCES")),
    evidenceOf(A, rel(A.id, concern.id, "ADDRESSES")),
    evidenceOf(B, rel(B.id, authorB.id, "PROPOSED_BY")),
    evidenceOf(B, rel(B.id, featX.id, "INTRODUCES")),
    evidenceOf(A),
    evidenceOf(B),
    evidenceOf(featX),
    evidenceOf(concern),
    evidenceOf(authorA),
    evidenceOf(authorB)
  ];

  const compoundQuery =
    "Who proposed EntityA, what did it introduce, and what concern did it address?";

  const validThreeClaimAnswer =
    "Alpha Spec was proposed by AuthorA. Alpha Spec introduced FeatureX. Alpha Spec addressed ConcernR.";

  it("A: valid 3-claim compound is SUPPORTED", () => {
    const context =
      ctx(compoundQuery, bag);

    const interpretation =
      interpretEvidencePaths(
        context.query,
        context,
        context.understanding
      );

    expect(interpretation.kind).toBe("CLAIM_SET");
    expect(interpretation.hopCount).toBe(0);
    expect(
      relationshipAttributionIsGrounded(
        validThreeClaimAnswer,
        context
      )
    ).toBe(true);

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer: validThreeClaimAnswer,
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(
      outcome.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(
      outcome.result.trace.steps
        .map(step => step.description)
        .join("\n")
    ).not.toMatch(/attribution mismatch/i);
  });

  it("B: valid 2-claim compound is SUPPORTED", () => {
    const query =
      "Who proposed EntityA and what did it introduce?";

    const context =
      ctx(query, bag);

    const answer =
      "Alpha Spec was proposed by AuthorA. Alpha Spec introduced FeatureX.";

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

    expect(
      outcome.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
    expect(outcome.result.confidence).toBeGreaterThan(0);
  });

  it("C: one unsupported atomic claim stays partial/not-supported", () => {
    const context =
      ctx(compoundQuery, bag);

    const answer =
      "Alpha Spec was proposed by AuthorA. Alpha Spec introduced FeatureX.";

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

    expect(
      outcome.result.trace.meta?.verificationStatus
    ).not.toBe("SUPPORTED");
    expect(
      ["PARTIALLY_SUPPORTED", "NOT_SUPPORTED"]
    ).toContain(
      outcome.result.trace.meta?.verificationStatus
    );
  });

  it("D: wrong subject attribution fails", () => {
    const context =
      ctx(compoundQuery, bag);

    const answer =
      "EntityB was proposed by AuthorA. EntityB introduced FeatureX. EntityB addressed ConcernR.";

    expect(
      relationshipAttributionIsGrounded(answer, context)
    ).toBe(false);

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

    expect(
      outcome.result.trace.meta?.verificationStatus
    ).not.toBe("SUPPORTED");
  });

  it("E: wrong predicate attribution fails", () => {
    const context =
      ctx(compoundQuery, bag);

    const answer =
      "Alpha Spec addresses FeatureX.";

    expect(
      relationshipAttributionIsGrounded(answer, context)
    ).toBe(false);
  });

  it("F: wrong object attribution fails", () => {
    const context =
      ctx(compoundQuery, bag);

    const answer =
      "Alpha Spec introduced ConcernR.";

    expect(
      relationshipAttributionIsGrounded(answer, context)
    ).toBe(false);
  });

  it("G: claim order permutation does not affect result", () => {
    const context =
      ctx(compoundQuery, bag);

    const permuted =
      "Alpha Spec addressed ConcernR. Alpha Spec was proposed by AuthorA. Alpha Spec introduced FeatureX.";

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer: permuted,
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(
      outcome.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
  });

  it("H: CLAIM_SET does not require a graph path", () => {
    const context =
      ctx(compoundQuery, bag);

    const interpretation =
      interpretEvidencePaths(
        context.query,
        context,
        context.understanding
      );

    expect(interpretation.kind).toBe("CLAIM_SET");
    expect(interpretation.hopCount).toBe(0);
    expect(interpretation.kind).not.toBe("MULTI_HOP");
  });

  it("I: no regression to direct relationship scoping", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("How is EntityA connected to FeatureX?"),
        bag
      );

    expect(relationKeys(selected)).toEqual([
      `${A.id}|INTRODUCES|${featX.id}`
    ]);
  });

  it("J: no regression to bridge reasoning", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery(
          "How are EntityA and EntityB connected through FeatureX?"
        ),
        bag
      );

    expect(relationKeys(selected)).toEqual([
      `${A.id}|INTRODUCES|${featX.id}`,
      `${B.id}|INTRODUCES|${featX.id}`
    ].sort());

    const context =
      ctx(
        "How are EntityA and EntityB connected through FeatureX?",
        bag
      );

    expect(
      interpretEvidencePaths(
        context.query,
        context,
        context.understanding
      ).kind
    ).toBe("BRIDGE");
  });

  it("K: generic SUPPORTED cannot override specific mismatch", () => {
    const context =
      ctx(compoundQuery, bag);

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer:
            "FeatureX was proposed by AuthorA.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    const steps =
      outcome.result.trace.steps
        .map(step => step.description)
        .join("\n");

    expect(
      outcome.result.trace.meta?.verificationStatus
    ).not.toBe("SUPPORTED");

    if (/attribution mismatch/i.test(steps)) {
      expect(steps).not.toMatch(
        /Verification: SUPPORTED — answer accepted/
      );
    }
  });

  it("L: semantic title wording maps to canonical bound evidence", () => {
    const context =
      ctx(compoundQuery, bag);

    expect(
      relationshipAttributionIsGrounded(
        validThreeClaimAnswer,
        context
      )
    ).toBe(true);

    expect(
      relationshipAttributionIsGrounded(
        "EntityA was proposed by AuthorA. EntityA introduced FeatureX. EntityA addressed ConcernR.",
        context
      )
    ).toBe(true);
  });

  it("foreign-subject compound evidence still fails closed", () => {
    const context =
      ctx(compoundQuery, bag);

    /*
     * EntityB's PROPOSED_BY must not support an EntityA proposal claim.
     */
    expect(
      relationshipAttributionIsGrounded(
        "EntityA was proposed by AuthorB.",
        context
      )
    ).toBe(false);
  });

  it("evidence order independence for compound selection", () => {
    const understanding =
      understandQuery(compoundQuery);

    expect(
      relationKeys(selectAnswerEvidence(understanding, shuffle(bag)))
    ).toEqual(
      relationKeys(selectAnswerEvidence(understanding, bag))
    );
  });

});
