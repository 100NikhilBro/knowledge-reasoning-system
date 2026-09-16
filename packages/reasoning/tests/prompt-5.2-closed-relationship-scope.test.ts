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
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

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
    const j = (i * 17 + 3) % (i + 1);
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

describe("Prompt 5.2 closed relationship scope + verification consistency", () => {

  const A =
    entity("proposal:a", "Proposal", "EntityA", { pep: "100" });
  const B =
    entity("proposal:b", "Proposal", "EntityB", { pep: "200" });
  const C =
    entity("proposal:c", "Proposal", "EntityC", { pep: "300" });
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
    evidenceOf(A, rel(A.id, authorA.id, "PROPOSED_BY"), 0.99),
    evidenceOf(A, rel(A.id, concern.id, "ADDRESSES"), 0.98),
    evidenceOf(A, rel(A.id, decision.id, "RESULTS_IN"), 0.97),
    evidenceOf(B, rel(B.id, featX.id, "INTRODUCES"), 0.96),
    evidenceOf(B, rel(B.id, authorB.id, "PROPOSED_BY"), 0.95),
    evidenceOf(C, rel(C.id, featX.id, "INTRODUCES"), 0.94),
    evidenceOf(featX),
    evidenceOf(concern),
    evidenceOf(authorA),
    evidenceOf(authorB),
    evidenceOf(decision),
    evidenceOf(A),
    evidenceOf(B),
    evidenceOf(C)
  ];

  it("1: FACT remains identity-only", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("What is EntityA?"),
        bag
      );

    expect(selected.every(item => !item.relationship)).toBe(true);
    expect(selected.every(item => item.entity.id === A.id)).toBe(true);
  });

  it("2: closed connected keeps only exact requested edge", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("How is EntityA connected to FeatureX?"),
        bag
      );

    expect(relationKeys(selected)).toEqual([
      `${A.id}|INTRODUCES|${featX.id}`
    ]);
  });

  it("3: shared object does not import foreign subjects", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("How is EntityA connected to FeatureX?"),
        bag
      );

    expect(
      selected.some(item =>
        item.relationship?.from === B.id ||
        item.relationship?.from === C.id
      )
    ).toBe(false);
  });

  it("4: bridge keeps exactly two spokes", () => {
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
  });

  it("5: bridge excludes proposer/decision edges", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery(
          "How are EntityA and EntityB connected through FeatureX?"
        ),
        bag
      );

    expect(
      selected.every(item =>
        !item.relationship ||
        item.relationship.type === "INTRODUCES"
      )
    ).toBe(true);
  });

  it("6: closed CONNECTED with shared hub keeps only validated spokes", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery("How is EntityA connected to EntityB?"),
        bag
      );

    expect(relationKeys(selected)).toEqual([
      `${A.id}|INTRODUCES|${featX.id}`,
      `${B.id}|INTRODUCES|${featX.id}`
    ].sort());

    expect(
      selected.some(item =>
        item.relationship?.type === "PROPOSED_BY"
      )
    ).toBe(false);
  });

  it("7: open exploration may retain subject neighborhood", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery(
          "How do EntityA and its related entities connect through multiple hops?"
        ),
        bag
      );

    const types =
      new Set(
        selected
          .map(item => item.relationship?.type)
          .filter(Boolean)
      );

    expect(types.has("INTRODUCES")).toBe(true);
    expect(types.size).toBeGreaterThan(1);
    expect(
      selected.every(item =>
        !item.relationship ||
        item.relationship.from === A.id
      )
    ).toBe(true);
  });

  it("8: compound binding still excludes foreign subjects", () => {
    const selected =
      selectAnswerEvidence(
        understandQuery(
          "Who proposed EntityA, what did it introduce, and what concern did it address?"
        ),
        bag
      );

    expect(
      selected.every(item =>
        !item.relationship ||
        item.relationship.from === A.id
      )
    ).toBe(true);
  });

  it("9/10: attribution mismatch is NOT_SUPPORTED and not overridden by SUPPORTED", () => {
    const context =
      ctx("How is EntityA connected to FeatureX?", bag);

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer: "FeatureX introduced EntityA.",
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

    expect(steps).toMatch(/attribution mismatch/i);
    expect(steps).not.toMatch(
      /Verification: SUPPORTED — answer accepted/
    );
    expect(
      outcome.result.trace.meta?.verificationStatus
    ).toBe("NOT_SUPPORTED");
  });

  it("11: compound claim set is CLAIM_SET — not fake MULTI_HOP", () => {
    const context =
      ctx(
        "Who proposed EntityA, what did it introduce, and what concern did it address?",
        bag
      );

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

  it("12: evidence order independence for closed connected", () => {
    const query =
      "How is EntityA connected to FeatureX?";

    const understanding =
      understandQuery(query);

    expect(
      relationKeys(selectAnswerEvidence(understanding, shuffle(bag)))
    ).toEqual(
      relationKeys(selectAnswerEvidence(understanding, bag))
    );
  });

  it("direct one-edge relation interprets as DIRECT", () => {
    const context =
      ctx("How is EntityA connected to FeatureX?", bag);

    const interpretation =
      interpretEvidencePaths(
        context.query,
        context,
        context.understanding
      );

    expect(interpretation.kind).toBe("DIRECT");
    expect(interpretation.hopCount).toBe(1);
  });

  it("bridge interprets as BRIDGE", () => {
    const context =
      ctx(
        "How are EntityA and EntityB connected through FeatureX?",
        bag
      );

    const interpretation =
      interpretEvidencePaths(
        context.query,
        context,
        context.understanding
      );

    expect(interpretation.kind).toBe("BRIDGE");
  });

  it("correct closed answer stays attribution-grounded and SUPPORTED", () => {
    const context =
      ctx("How is EntityA connected to FeatureX?", bag);

    const answer =
      "EntityA introduced FeatureX.";

    expect(
      relationshipAttributionIsGrounded(answer, context)
    ).toBe(true);

    const verification =
      verifyAnswerAgainstIntent(answer, context);

    expect(verification.semantics.status).toBe("SUPPORTED");

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

    expect(
      outcome.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
    expect(relationKeys(context.evidence)).toEqual([
      `${A.id}|INTRODUCES|${featX.id}`
    ]);
  });

});
