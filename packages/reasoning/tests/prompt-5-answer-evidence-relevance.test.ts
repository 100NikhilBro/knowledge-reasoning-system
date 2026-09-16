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
  deriveAnswerEvidenceScope,
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
    const j = (i * 11 + 5) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function keysOf(evidence: Evidence[]): string[] {
  return evidence
    .map(item =>
      item.relationship
        ? `${item.entity.id}|${item.relationship.type}|${item.relationship.from}|${item.relationship.to}`
        : `entity:${item.entity.id}`
    )
    .sort();
}

function ctx(
  query: string,
  evidence: Evidence[]
): ReasoningContext {
  const understanding =
    understandQuery(query);

  const selected =
    selectAnswerEvidence(understanding, evidence);

  return {
    query,
    understanding,
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
      inputCount: evidence.length,
      retainedCount: selected.length,
      truncated: false
    },
    config: { maxEvidence: 50 }
  };
}

describe("Prompt 5 query-focused answer evidence", () => {

  const A =
    entity("proposal:a", "Proposal", "EntityA", { pep: "100" });
  const B =
    entity("proposal:b", "Proposal", "EntityB", { pep: "200" });
  const featX =
    entity("feature:x", "Feature", "FeatureX");
  const featY =
    entity("feature:y", "Feature", "FeatureY");
  const concern =
    entity("concern:r", "Concern", "ConcernR");
  const authorA =
    entity("author:a", "Author", "AuthorA");
  const authorB =
    entity("author:b", "Author", "AuthorB");
  const decision =
    entity("decision:f", "Decision", "FinalDecision");
  const version =
    entity("version:3.5", "PythonVersion", "3.5");

  const aIntro =
    rel(A.id, featX.id, "INTRODUCES");
  const aAddresses =
    rel(A.id, concern.id, "ADDRESSES");
  const aProposed =
    rel(A.id, authorA.id, "PROPOSED_BY");
  const aResults =
    rel(A.id, decision.id, "RESULTS_IN");
  const aImplemented =
    rel(A.id, version.id, "IMPLEMENTED_IN");
  const bIntro =
    rel(B.id, featY.id, "INTRODUCES");
  const bProposed =
    rel(B.id, authorB.id, "PROPOSED_BY");
  const bAddresses =
    rel(B.id, concern.id, "ADDRESSES");

  const noisyNeighborhood = [
    evidenceOf(A, aIntro, 0.5),
    evidenceOf(A, aAddresses, 0.99),
    evidenceOf(A, aProposed, 0.4),
    evidenceOf(A, aResults, 0.98),
    evidenceOf(A, aImplemented, 0.97),
    evidenceOf(B, bIntro, 0.96),
    evidenceOf(B, bProposed, 0.95),
    evidenceOf(B, bAddresses, 0.94),
    evidenceOf(featX),
    evidenceOf(featY),
    evidenceOf(concern),
    evidenceOf(authorA),
    evidenceOf(authorB),
    evidenceOf(decision),
    evidenceOf(version),
    evidenceOf(A)
  ];

  it("A: FACT relevance does not dump neighborhood", () => {
    const query =
      "What is EntityA?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    expect(
      selected.every(item => !item.relationship)
    ).toBe(true);

    expect(
      selected.every(item =>
        item.entity.id === A.id
      )
    ).toBe(true);

    const answer =
      buildIdentityGroundedAnswer(ctx(query, noisyNeighborhood));

    expect(answer).toMatch(/EntityA/i);
    expect(answer).not.toMatch(/AuthorA|ConcernR|FeatureX|FinalDecision/i);
    expect(answer).not.toMatch(/Related grounded entities/i);
  });

  it("B: direct relationship keeps only requested edge", () => {
    const query =
      "What is the direct relationship between EntityA and FeatureX?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    const types =
      selected
        .map(item => item.relationship?.type)
        .filter(Boolean);

    expect(types.every(type => type === "INTRODUCES")).toBe(true);
    expect(
      selected.some(item =>
        item.relationship?.type === "ADDRESSES"
      )
    ).toBe(false);
  });

  it("C: bridge relevance keeps only A/X/B path evidence", () => {
    const query =
      "How are EntityA and EntityB connected through FeatureX?";

    const bridgeEvidence = [
      evidenceOf(A, aIntro),
      evidenceOf(B, rel(B.id, featX.id, "INTRODUCES")),
      evidenceOf(featX),
      evidenceOf(A, aProposed),
      evidenceOf(A, aAddresses),
      evidenceOf(B, bProposed),
      evidenceOf(authorA),
      evidenceOf(concern)
    ];

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        bridgeEvidence
      );

    expect(
      selected.some(item =>
        item.relationship?.type === "PROPOSED_BY"
      )
    ).toBe(false);

    expect(
      selected.some(item =>
        item.relationship?.type === "ADDRESSES"
      )
    ).toBe(false);

    expect(
      selected.some(item =>
        item.relationship?.type === "INTRODUCES"
      )
    ).toBe(true);
  });

  it("D: connected relevance keeps endpoint path evidence", () => {
    const query =
      "How is EntityA connected to FeatureX?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    expect(
      selected.some(item =>
        item.relationship?.type === "INTRODUCES" &&
        item.relationship.to === featX.id
      )
    ).toBe(true);

    expect(
      selected.every(item =>
        !item.relationship ||
        (
          item.relationship.from === A.id ||
          item.relationship.to === A.id ||
          item.relationship.from === featX.id ||
          item.relationship.to === featX.id
        )
      )
    ).toBe(true);
  });

  it("E: foreign entity spillover excluded", () => {
    const query =
      "What did EntityA introduce?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    expect(
      selected.some(item =>
        item.relationship?.from === B.id
      )
    ).toBe(false);

    const answer =
      buildRelationalGroundedAnswer(
        ctx(query, noisyNeighborhood)
      ) ?? "";

    expect(answer).toMatch(/EntityA/i);
    expect(answer).toMatch(/FeatureX/i);
    expect(answer).not.toMatch(/EntityB|FeatureY/i);
  });

  it("F: foreign predicate spillover excluded", () => {
    const query =
      "What did EntityA introduce?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    const types =
      new Set(
        selected
          .map(item => item.relationship?.type)
          .filter(Boolean)
      );

    expect([...types]).toEqual(["INTRODUCES"]);
  });

  it("G: foreign object spillover excluded", () => {
    const query =
      "Does EntityA introduce FeatureY?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        [
          evidenceOf(A, aIntro),
          evidenceOf(featX),
          evidenceOf(featY),
          evidenceOf(A, rel(A.id, featY.id, "INTRODUCES"))
        ]
      );

    /*
     * When the typed edge names FeatureY, only A→FeatureY is relevant.
     */
    const introTargets =
      selected
        .filter(item => item.relationship?.type === "INTRODUCES")
        .map(item => item.relationship!.to);

    expect(introTargets.every(id => id === featY.id)).toBe(true);
  });

  it("H: compound query keeps each requested claim", () => {
    const query =
      "Who proposed EntityA, what did it introduce, and what concern did it address?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    const types =
      new Set(
        selected
          .map(item => item.relationship?.type)
          .filter(Boolean)
      );

    expect(types.has("PROPOSED_BY")).toBe(true);
    expect(types.has("INTRODUCES")).toBe(true);
    expect(types.has("ADDRESSES")).toBe(true);
    expect(types.has("RESULTS_IN")).toBe(false);
    expect(types.has("IMPLEMENTED_IN")).toBe(false);

    expect(
      selected.some(item =>
        item.relationship?.from === B.id
      )
    ).toBe(false);
  });

  it("I: analytical context drops unrelated relationships", () => {
    const query =
      "How many proposals introduce FeatureX?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    expect(
      selected.every(item =>
        !item.relationship ||
        item.relationship.type === "INTRODUCES"
      )
    ).toBe(true);
  });

  it("J: comparison context respects subjects/dimensions", () => {
    const query =
      "Compare EntityA and EntityB based on what they introduce.";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    expect(
      selected.every(item =>
        !item.relationship ||
        item.relationship.type === "INTRODUCES"
      )
    ).toBe(true);

    expect(
      selected.some(item =>
        item.relationship?.type === "ADDRESSES"
      )
    ).toBe(false);
  });

  it("K: implication context stays claim-specific", () => {
    const query =
      "EntityA introduces FeatureX and EntityA addresses ConcernR.";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        noisyNeighborhood
      );

    const types =
      new Set(
        selected
          .map(item => item.relationship?.type)
          .filter(Boolean)
      );

    expect(types.has("INTRODUCES")).toBe(true);
    expect(types.has("ADDRESSES")).toBe(true);
    expect(types.has("PROPOSED_BY")).toBe(false);
  });

  it("L: provenance is preserved on retained evidence", () => {
    const withPath: Evidence = {
      entity: A,
      score: 0.9,
      source: "graph",
      relationship: aIntro,
      path: {
        nodes: [A, featX],
        relationships: [aIntro],
        length: 1
      },
      metadata: { channel: "hybrid" }
    };

    const selected =
      selectAnswerEvidence(
        understandQuery("What did EntityA introduce?"),
        [withPath, evidenceOf(A, aAddresses)]
      );

    const kept =
      selected.find(item =>
        item.relationship?.type === "INTRODUCES"
      );

    expect(kept?.source).toBe("graph");
    expect(kept?.path?.length).toBe(1);
    expect(kept?.metadata?.channel).toBe("hybrid");
  });

  it("M: evidence-order independence", () => {
    const query =
      "What did EntityA introduce?";

    const understanding =
      understandQuery(query);

    const first =
      keysOf(selectAnswerEvidence(understanding, noisyNeighborhood));
    const second =
      keysOf(
        selectAnswerEvidence(
          understanding,
          shuffle(noisyNeighborhood)
        )
      );

    expect(second).toEqual(first);
  });

  it("N: lexical trap entity excluded", () => {
    const similar =
      entity("proposal:trap", "Proposal", "EntityAlmostA");

    const selected =
      selectAnswerEvidence(
        understandQuery("What did EntityA introduce?"),
        [
          evidenceOf(A, aIntro),
          evidenceOf(similar, rel(similar.id, featY.id, "INTRODUCES")),
          evidenceOf(featX),
          evidenceOf(featY)
        ]
      );

    expect(
      selected.some(item =>
        item.entity.id === similar.id ||
        item.relationship?.from === similar.id
      )
    ).toBe(false);
  });

  it("O: high retrieval score cannot override semantic irrelevance", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("Who proposed EntityA?"),
        [
          evidenceOf(A, aAddresses, 0.99),
          evidenceOf(A, aProposed, 0.1),
          evidenceOf(concern, undefined, 0.99),
          evidenceOf(authorA, undefined, 0.1)
        ]
      );

    expect(
      selected.some(item =>
        item.relationship?.type === "PROPOSED_BY"
      )
    ).toBe(true);

    expect(
      selected.some(item =>
        item.relationship?.type === "ADDRESSES"
      )
    ).toBe(false);
  });

  it("P: missing requested evidence fails closed — no nearby fill", () => {
    const query =
      "Who proposed EntityA?";

    const selected =
      selectAnswerEvidence(
        understandQuery(query),
        [
          evidenceOf(A, aIntro),
          evidenceOf(A, aAddresses),
          evidenceOf(featX),
          evidenceOf(concern),
          evidenceOf(A)
        ]
      );

    expect(
      selected.some(item => item.relationship)
    ).toBe(false);

    const verification =
      verifyAnswerAgainstIntent(
        "EntityA was proposed by AuthorA.",
        ctx(query, [
          evidenceOf(A, aIntro),
          evidenceOf(A)
        ])
      );

    expect(verification.exceedsEvidence || verification.semantics.status !== "SUPPORTED")
      .toBe(true);
  });

  it("Q: natural FACT answer is concise", async () => {
    const query =
      "What is EntityA?";

    const context =
      ctx(query, noisyNeighborhood);

    const result =
      await new DefaultAnswerGenerator().generate(context);

    expect(result.answer).toMatch(/EntityA/i);
    expect(result.answer).not.toMatch(/AuthorA|ConcernR|FinalDecision|Related grounded/i);
    expect(result.answer.split(".").length).toBeLessThanOrEqual(3);
  });

  it("R: production-style regressions stay scoped", () => {
    const compound =
      "Who proposed EntityA, what did it introduce, and what concern did it address?";

    const compoundSelected =
      selectAnswerEvidence(
        understandQuery(compound),
        noisyNeighborhood
      );

    expect(
      deriveAnswerEvidenceScope(understandQuery(compound))
        .requestedPredicates
        .sort()
    ).toEqual(["ADDRESSES", "INTRODUCES", "PROPOSED_BY"].sort());

    expect(
      compoundSelected.every(item =>
        !item.relationship ||
        ["PROPOSED_BY", "INTRODUCES", "ADDRESSES"].includes(
          item.relationship.type
        )
      )
    ).toBe(true);

    const direct =
      selectAnswerEvidence(
        understandQuery(
          "What is the direct relationship between EntityA and FeatureX?"
        ),
        noisyNeighborhood
      );

    expect(
      direct.every(item =>
        !item.relationship ||
        item.relationship.type === "INTRODUCES"
      )
    ).toBe(true);

    const bridge =
      selectAnswerEvidence(
        understandQuery(
          "How are EntityA and EntityB connected through FeatureX?"
        ),
        [
          evidenceOf(A, aIntro),
          evidenceOf(B, rel(B.id, featX.id, "INTRODUCES")),
          evidenceOf(featX),
          evidenceOf(A, aProposed),
          evidenceOf(B, bProposed)
        ]
      );

    expect(
      bridge.every(item =>
        !item.relationship ||
        item.relationship.type === "INTRODUCES"
      )
    ).toBe(true);
  });

  it("verification rejects foreign-predicate answer text", () => {
    const query =
      "What did EntityA introduce?";

    const verification =
      verifyAnswerAgainstIntent(
        "EntityA introduced FeatureX and EntityA addresses ConcernR.",
        ctx(query, noisyNeighborhood)
      );

    expect(verification.exceedsEvidence).toBe(true);
    expect(verification.matchesIntent).toBe(false);
  });

  it("focused generator answer stays within INTRODUCES scope", async () => {
    const query =
      "What did EntityA introduce?";

    const result =
      await new DefaultAnswerGenerator().generate(
        ctx(query, noisyNeighborhood)
      );

    expect(result.answer).toMatch(/introduced|introduces/i);
    expect(result.answer).not.toMatch(/addresses|proposed by|resulted in/i);
    expect(result.answer).not.toMatch(/EntityB/i);
  });

});
