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
  bindClaimEvidence,
  buildStructuredAnswerContext,
  selectAnswerEvidence
} from "../src/utils/select-answer-evidence.js";

import {
  buildIdentityGroundedAnswer,
  buildPartialGroundedAnswer,
  buildRelationalGroundedAnswer
} from "../src/utils/build-partial-grounded-answer.js";

import {
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

import {
  interpretEvidencePaths
} from "../src/utils/interpret-path.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

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
  score = 0.95,
  path?: Evidence["path"]
): Evidence {
  return {
    entity: node,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {}),
    ...(path ? { path } : {})
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 13 + 7) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function keysOf(evidence: Evidence[]): string[] {
  return evidence
    .map(item =>
      item.relationship
        ? `${item.relationship.from}|${item.relationship.type}|${item.relationship.to}`
        : `entity:${item.entity.id}`
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

  const answerContext =
    buildStructuredAnswerContext(understanding, selected);

  return {
    query,
    understanding,
    answerContext,
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

describe("Prompt 5.1 strict answer scope", () => {

  const A =
    entity("proposal:a", "Proposal", "EntityA", { pep: "100" });
  const B =
    entity("proposal:b", "Proposal", "EntityB", { pep: "200" });
  const C =
    entity("proposal:c", "Proposal", "EntityC", { pep: "300" });
  const D =
    entity("proposal:d", "Proposal", "EntityD", { pep: "400" });
  const featX =
    entity("feature:x", "Feature", "FeatureX");
  const concern =
    entity("concern:r", "Concern", "ConcernR");
  const authorA =
    entity("author:a", "Author", "AuthorA");
  const authorB =
    entity("author:b", "Author", "AuthorB");
  const decision =
    entity("decision:f", "Decision", "FinalDecision");

  const bag: Evidence[] = [
    evidenceOf(A, rel(A.id, featX.id, "INTRODUCES"), 0.5),
    evidenceOf(A, rel(A.id, authorA.id, "PROPOSED_BY"), 0.4),
    evidenceOf(A, rel(A.id, concern.id, "ADDRESSES"), 0.6),
    evidenceOf(A, rel(A.id, decision.id, "RESULTS_IN"), 0.98),
    evidenceOf(B, rel(B.id, featX.id, "INTRODUCES"), 0.99),
    evidenceOf(B, rel(B.id, authorB.id, "PROPOSED_BY"), 0.97),
    evidenceOf(B, rel(B.id, concern.id, "ADDRESSES"), 0.96),
    evidenceOf(C, rel(C.id, featX.id, "INTRODUCES"), 0.95),
    evidenceOf(D, rel(D.id, featX.id, "INTRODUCES"), 0.94),
    evidenceOf(featX),
    evidenceOf(concern),
    evidenceOf(authorA),
    evidenceOf(authorB),
    evidenceOf(decision),
    evidenceOf(A),
    evidenceOf(B),
    evidenceOf(C),
    evidenceOf(D)
  ];

  it("A: FACT answer accepted without requiring a graph path", async () => {
    const query =
      "What is EntityA?";

    const context =
      ctx(query, bag);

    expect(
      context.evidence.every(item => !item.relationship)
    ).toBe(true);

    expect(
      context.evidence.every(item => item.entity.id === A.id)
    ).toBe(true);

    const path =
      interpretEvidencePaths(query, context);

    expect(path.kind).toBe("FACT_IDENTITY");
    expect(path.supportsClaim).toBe(true);

    const answer =
      buildIdentityGroundedAnswer(context);

    const verification =
      verifyAnswerAgainstIntent(answer, context);

    expect(verification.semantics.status).toBe("SUPPORTED");
    expect(verification.exceedsEvidence).toBe(false);
    expect(verification.matchesIntent).toBe(true);

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer,
          confidence: 1,
          citations: [{ entityId: A.id, source: "fixture.md" }],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/EntityA/i);
    expect(outcome.result.answer).not.toMatch(/AuthorA|ConcernR|FeatureX/i);
    expect(outcome.result.trace.steps.join("\n")).not.toMatch(
      /relationship not established/i
    );
  });

  it("B: who-proposed keeps only proposer evidence", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("Who proposed EntityA?"),
        bag
      );

    expect(
      selected.every(item =>
        !item.relationship ||
        (
          item.relationship.type === "PROPOSED_BY" &&
          item.relationship.from === A.id
        )
      )
    ).toBe(true);

    const answer =
      buildRelationalGroundedAnswer(
        ctx("Who proposed EntityA?", bag)
      ) ?? "";

    expect(answer).toMatch(/AuthorA/i);
    expect(answer).not.toMatch(/AuthorB|FeatureX|ConcernR|EntityB/i);
  });

  it("C: introduce query excludes shared-target foreign subjects", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("What did EntityA introduce?"),
        bag
      );

    expect(
      selected.some(item =>
        item.relationship?.from === B.id ||
        item.relationship?.from === C.id ||
        item.relationship?.from === D.id
      )
    ).toBe(false);

    const answer =
      buildRelationalGroundedAnswer(
        ctx("What did EntityA introduce?", bag)
      ) ?? "";

    expect(answer).toMatch(/EntityA/i);
    expect(answer).toMatch(/FeatureX/i);
    expect(answer).not.toMatch(/EntityB|EntityC|EntityD/i);
  });

  it("D: connected query keeps only A↔FeatureX edge", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("How is EntityA connected to FeatureX?"),
        bag
      );

    const relTypes =
      selected
        .map(item => item.relationship?.type)
        .filter(Boolean);

    expect(relTypes.every(type => type === "INTRODUCES")).toBe(true);
    expect(
      selected.some(item =>
        item.relationship?.type === "PROPOSED_BY" ||
        item.relationship?.type === "ADDRESSES"
      )
    ).toBe(false);

    const leaky =
      verifyAnswerAgainstIntent(
        "EntityA introduced FeatureX. EntityB introduced FeatureX.",
        ctx("How is EntityA connected to FeatureX?", bag)
      );

    expect(leaky.exceedsEvidence).toBe(true);
  });

  it("E: direct relationship between A and FeatureX only", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery(
          "What is the direct relationship between EntityA and FeatureX?"
        ),
        bag
      );

    expect(
      selected.every(item =>
        !item.relationship ||
        (
          item.relationship.type === "INTRODUCES" &&
          item.relationship.from === A.id &&
          item.relationship.to === featX.id
        )
      )
    ).toBe(true);
  });

  it("F: bridge keeps only A/X/B spokes — not proposers", () => {
    const withSpuriousPath =
      bag.map(item => {
        if (
          item.relationship?.type === "PROPOSED_BY" &&
          item.relationship.from === B.id
        ) {
          return {
            ...item,
            path: {
              nodes: [B, featX, D],
              relationships: [item.relationship],
              length: 2
            }
          };
        }
        return item;
      });

    const selected =
      selectAnswerEvidence(
        understandQuery(
          "How are EntityB and EntityD connected through FeatureX?"
        ),
        withSpuriousPath
      );

    expect(
      selected.some(item =>
        item.relationship?.type === "PROPOSED_BY"
      )
    ).toBe(false);

    expect(
      selected.filter(item => item.relationship).every(item =>
        item.relationship!.type === "INTRODUCES" &&
        (
          item.relationship!.from === B.id ||
          item.relationship!.from === D.id
        ) &&
        item.relationship!.to === featX.id
      )
    ).toBe(true);
  });

  it("G: compound binds only subject EntityA claims", () => {
    const query =
      "Who proposed EntityA, what did it introduce, and what concern did it address?";

    const understanding =
      understandQuery(query);

    const selected =
      selectAnswerEvidence(understanding, bag);

    const structured =
      buildStructuredAnswerContext(understanding, selected);

    expect(structured.claimEvidence).toHaveLength(3);

    for (const claim of structured.claimEvidence) {
      expect(
        claim.evidence.every(item =>
          !item.relationship ||
          item.relationship.from === A.id
        )
      ).toBe(true);
    }

    expect(
      selected.some(item =>
        item.relationship?.from === B.id ||
        item.relationship?.from === C.id
      )
    ).toBe(false);

    const answer =
      buildPartialGroundedAnswer(ctx(query, bag));

    expect(answer).toMatch(/AuthorA|proposed/i);
    expect(answer).toMatch(/FeatureX|introduced/i);
    expect(answer).toMatch(/ConcernR|addressed/i);
    expect(answer).not.toMatch(/EntityB|EntityC|EntityD|AuthorB/i);
  });

  it("H: EntityB introduce remains subject-bound", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("What did EntityB introduce?"),
        bag
      );

    expect(
      selected.every(item =>
        !item.relationship ||
        item.relationship.from === B.id
      )
    ).toBe(true);
  });

  it("adversarial: path provenance cannot reintroduce proposers", () => {
    const noisy = [
      evidenceOf(
        B,
        rel(B.id, authorB.id, "PROPOSED_BY"),
        0.99,
        {
          nodes: [B, featX, D],
          relationships: [rel(B.id, featX.id, "INTRODUCES")],
          length: 2
        }
      ),
      evidenceOf(B, rel(B.id, featX.id, "INTRODUCES")),
      evidenceOf(D, rel(D.id, featX.id, "INTRODUCES")),
      evidenceOf(featX),
      evidenceOf(authorB)
    ];

    const selected =
      selectAnswerEvidence(
        understandQuery(
          "How are EntityB and EntityD connected through FeatureX?"
        ),
        noisy
      );

    expect(
      selected.some(item =>
        item.relationship?.type === "PROPOSED_BY"
      )
    ).toBe(false);
  });

  it("adversarial: raw evidence is not reintroduced by generator/verifier", async () => {
    const query =
      "What did EntityA introduce?";

    const understanding =
      understandQuery(query);

    const broad =
      [...bag];

    const context: ReasoningContext = {
      query,
      understanding,
      evidence: broad,
      items: broad.map(item => ({
        entityId: item.entity.id,
        entityType: item.entity.type,
        label: item.entity.label,
        source: item.entity.source,
        confidence: 1,
        score: item.score,
        evidenceSource: item.source,
        properties: item.entity.properties ?? {},
        ...(item.relationship
          ? { relationship: item.relationship }
          : {})
      })),
      budget: {
        maxEvidence: 50,
        inputCount: broad.length,
        retainedCount: broad.length,
        truncated: false
      },
      config: { maxEvidence: 50 }
    };

    const generated =
      await new DefaultAnswerGenerator().generate(context);

    expect(context.answerContext).toBeDefined();
    expect(
      context.evidence.every(item =>
        !item.relationship ||
        item.relationship.from === A.id
      )
    ).toBe(true);

    expect(generated.answer).not.toMatch(/EntityB|EntityC|EntityD/i);

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(outcome.result.answer).not.toMatch(/EntityB|EntityC|EntityD/i);
  });

  it("adversarial: order independence of scoped evidence", () => {
    const query =
      "Who proposed EntityA, what did it introduce, and what concern did it address?";

    const understanding =
      understandQuery(query);

    expect(
      keysOf(selectAnswerEvidence(understanding, shuffle(bag)))
    ).toEqual(
      keysOf(selectAnswerEvidence(understanding, bag))
    );
  });

  it("adversarial: high-score foreign subject excluded", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("What did EntityA introduce?"),
        bag
      );

    expect(
      selected.some(item =>
        item.relationship?.from === B.id &&
        item.score >= 0.99
      )
    ).toBe(false);
  });

  it("adversarial: claim binding excludes cross-subject leakage", () => {
    const understanding =
      understandQuery(
        "Who proposed EntityA, what did it introduce, and what concern did it address?"
      );

    const scoped =
      selectAnswerEvidence(understanding, bag);

    const claims =
      bindClaimEvidence(
        buildStructuredAnswerContext(understanding, scoped).scope,
        scoped
      );

    for (const claim of claims) {
      expect(
        claim.evidence
          .filter(item => item.relationship)
          .every(item => item.relationship!.from === A.id)
      ).toBe(true);
    }
  });

});
