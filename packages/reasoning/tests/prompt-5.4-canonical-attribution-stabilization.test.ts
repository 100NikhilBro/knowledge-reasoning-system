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
  normalizeEntityPhrase
} from "../src/utils/detect-relationship-between-query.js";

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
    const j = (i * 23 + 7) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

describe("Prompt 5.4 canonical attribution stabilization", () => {

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
  const C =
    entity("proposal:c", "Proposal", "EntityC", {
      pep: "300",
      title: "Gamma Spec"
    });
  const featX =
    entity("feature:x", "Feature", "FeatureX");
  const concern =
    entity("concern:r", "Concern", "ConcernR");
  const author =
    entity("author:a", "Author", "AuthorA");

  const bag: Evidence[] = [
    evidenceOf(A, rel(A.id, featX.id, "INTRODUCES")),
    evidenceOf(A, rel(A.id, author.id, "PROPOSED_BY")),
    evidenceOf(A, rel(A.id, concern.id, "ADDRESSES")),
    evidenceOf(B, rel(B.id, featX.id, "INTRODUCES")),
    evidenceOf(B, rel(B.id, author.id, "PROPOSED_BY")),
    evidenceOf(C, rel(C.id, featX.id, "INTRODUCES")),
    evidenceOf(A),
    evidenceOf(B),
    evidenceOf(C),
    evidenceOf(featX),
    evidenceOf(concern),
    evidenceOf(author)
  ];

  const introduceQuery =
    "What did EntityA introduce?";

  const validForms = [
    "EntityA introduced FeatureX.",
    "Alpha Spec introduced FeatureX.",
    "EntityA introduced the FeatureX feature.",
    "Alpha Spec introduced the FeatureX feature.",
    "FeatureX was introduced by EntityA.",
    "FeatureX was introduced by Alpha Spec."
  ];

  it("A/B/C/D: valid semantic forms of the same bound edge are SUPPORTED", () => {
    expect(normalizeEntityPhrase("the FeatureX feature")).toBe("FeatureX");

    const context =
      ctx(introduceQuery, bag);

    for (const answer of validForms) {
      expect(
        relationshipAttributionIsGrounded(answer, context),
        answer
      ).toBe(true);

      const outcome =
        verify(answer, context);

      expect(
        outcome.result.trace.meta?.verificationStatus,
        answer
      ).toBe("SUPPORTED");
      expect(outcome.result.confidence).toBeGreaterThan(0);
    }
  });

  it("E: compound CLAIM_SET with aliases is SUPPORTED", () => {
    const query =
      "Who proposed EntityA, what did it introduce, and what concern did it address?";

    const context =
      ctx(query, bag);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("CLAIM_SET");

    const answer =
      "Alpha Spec was proposed by AuthorA. Alpha Spec introduced FeatureX. Alpha Spec addressed ConcernR.";

    const outcome =
      verify(answer, context);

    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

  it("F: connected direct edge accepts subject alias", () => {
    const query =
      "How is EntityA connected to FeatureX?";

    const context =
      ctx(query, bag);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("DIRECT");

    const outcome =
      verify("Alpha Spec introduced FeatureX.", context);

    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

  it("G: bridge with endpoint aliases is SUPPORTED", () => {
    const query =
      "How are EntityA and EntityB connected through FeatureX?";

    const context =
      ctx(query, bag);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("BRIDGE");

    const outcome =
      verify(
        "Alpha Spec introduced FeatureX. Beta Spec introduced FeatureX.",
        context
      );

    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

  it("H: wrong subject fails", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded(
        "EntityB introduced FeatureX.",
        context
      )
    ).toBe(false);
  });

  it("I: wrong predicate fails", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded(
        "EntityA addresses FeatureX.",
        context
      )
    ).toBe(false);
  });

  it("J: wrong object fails", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded(
        "EntityA introduced ConcernR.",
        context
      )
    ).toBe(false);
  });

  it("K: wrong bridge endpoint fails", () => {
    const query =
      "How are EntityA and EntityB connected through FeatureX?";

    const context =
      ctx(query, bag);

    const outcome =
      verify(
        "Alpha Spec introduced FeatureX. Gamma Spec introduced FeatureX.",
        context
      );

    expect(outcome.result.trace.meta?.verificationStatus)
      .not.toBe("SUPPORTED");
  });

  it("L: object-only relationship answer does not vacuous-pass", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded("FeatureX", context)
    ).toBe(false);

    const outcome =
      verify("FeatureX", context);

    expect(outcome.result.trace.meta?.verificationStatus)
      .not.toBe("SUPPORTED");
  });

  it("M: evidence order permutation does not change valid result", () => {
    const context =
      ctx(introduceQuery, shuffle(bag));

    const outcome =
      verify("Alpha Spec introduced FeatureX.", context);

    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

  it("N: claim order permutation does not change compound result", () => {
    const query =
      "Who proposed EntityA, what did it introduce, and what concern did it address?";

    const context =
      ctx(query, bag);

    const outcome =
      verify(
        "Alpha Spec addressed ConcernR. Alpha Spec was proposed by AuthorA. Alpha Spec introduced FeatureX.",
        context
      );

    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

  it("O: genuine attribution mismatch cannot be bypassed", () => {
    const context =
      ctx(introduceQuery, bag);

    const outcome =
      verify("FeatureX introduced EntityA.", context);

    const steps =
      outcome.result.trace.steps
        .map(step => step.description)
        .join("\n");

    expect(
      relationshipAttributionIsGrounded(
        "FeatureX introduced EntityA.",
        context
      )
    ).toBe(false);

    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("NOT_SUPPORTED");

    expect(steps).toMatch(/attribution mismatch/i);
    expect(steps).not.toMatch(
      /Verification: SUPPORTED — answer accepted/
    );
  });

  it("production-like repeated valid forms stay SUPPORTED (10×)", () => {
    const context =
      ctx(introduceQuery, bag);

    for (let run = 0; run < 10; run++) {
      for (const answer of [
        "EntityA introduced FeatureX.",
        "Alpha Spec introduced FeatureX.",
        "EntityA introduced the FeatureX feature.",
        "Alpha Spec introduced the FeatureX feature."
      ]) {
        const outcome =
          verify(answer, context);

        expect(
          outcome.result.trace.meta?.verificationStatus,
          `run=${run} answer=${answer}`
        ).toBe("SUPPORTED");
      }
    }
  });

  it("Q3–Q8 style queries: valid alias answers are stable across 10 runs", () => {
    const cases: Array<{ query: string; answer: string }> = [
      {
        query: "What did EntityA introduce?",
        answer: "Alpha Spec introduced the FeatureX feature."
      },
      {
        query: "How is EntityA connected to FeatureX?",
        answer: "Alpha Spec introduced FeatureX."
      },
      {
        query: "What is the direct relationship between EntityB and FeatureX?",
        answer: "Beta Spec introduced FeatureX."
      },
      {
        query: "How are EntityA and EntityB connected through FeatureX?",
        answer:
          "Alpha Spec introduced FeatureX. Beta Spec introduced FeatureX."
      },
      {
        query:
          "Who proposed EntityA, what did it introduce, and what concern did it address?",
        answer:
          "Alpha Spec was proposed by AuthorA. Alpha Spec introduced FeatureX. Alpha Spec addressed ConcernR."
      },
      {
        query: "What did EntityB introduce?",
        answer: "Beta Spec introduced FeatureX."
      }
    ];

    for (const entry of cases) {
      const context =
        ctx(entry.query, bag);

      for (let run = 0; run < 10; run++) {
        const outcome =
          verify(entry.answer, context);

        expect(
          outcome.result.trace.meta?.verificationStatus,
          `${entry.query} run=${run}`
        ).toBe("SUPPORTED");
      }
    }
  });

});
