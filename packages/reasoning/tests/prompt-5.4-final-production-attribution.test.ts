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
 * Production-style Prompt 5.4 final harness.
 * Uses fixed ClaimEvidence / answerEvidence and multiple equivalent forms.
 * No LLM involvement.
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
    const j = (i * 29 + 11) % (i + 1);
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

function expectSupported(
  answer: string,
  context: ReasoningContext
): void {
  expect(
    relationshipAttributionIsGrounded(answer, context),
    `attr:${answer}`
  ).toBe(true);

  const outcome =
    verify(answer, context);

  expect(
    outcome.result.trace.meta?.verificationStatus,
    `status:${answer}`
  ).toBe("SUPPORTED");

  expect(outcome.result.confidence).toBeGreaterThan(0);

  const steps =
    outcome.result.trace.steps
      .map(step => step.description)
      .join("\n");

  expect(steps).not.toMatch(/attribution mismatch/i);
}

describe("Prompt 5.4 final production attribution harness", () => {

  const proposalA =
    entity("proposal:PEP-484", "Proposal", "Type Hints", {
      pep: "484",
      title: "Type Hints"
    });
  const proposalB =
    entity("proposal:PEP-526", "Proposal", "Variable Annotations", {
      pep: "526",
      title: "Variable Annotations"
    });
  const proposalC =
    entity("proposal:PEP-604", "Proposal", "Union Syntax", {
      pep: "604",
      title: "Union Syntax"
    });
  const proposalForeign =
    entity("proposal:PEP-544", "Proposal", "Protocols", {
      pep: "544",
      title: "Protocols"
    });
  const feature =
    entity("feature:typing", "Feature", "Typing");
  const author =
    entity("author:guido", "Author", "Guido van Rossum");
  const concern =
    entity("concern:readability", "Concern", "Readability");

  const bag: Evidence[] = [
    evidenceOf(proposalA, rel(proposalA.id, feature.id, "INTRODUCES")),
    evidenceOf(proposalA, rel(proposalA.id, author.id, "PROPOSED_BY")),
    evidenceOf(proposalA, rel(proposalA.id, concern.id, "ADDRESSES")),
    evidenceOf(proposalB, rel(proposalB.id, feature.id, "INTRODUCES")),
    evidenceOf(proposalC, rel(proposalC.id, feature.id, "INTRODUCES")),
    evidenceOf(proposalForeign, rel(proposalForeign.id, feature.id, "INTRODUCES")),
    evidenceOf(proposalA),
    evidenceOf(proposalB),
    evidenceOf(proposalC),
    evidenceOf(proposalForeign),
    evidenceOf(feature),
    evidenceOf(author),
    evidenceOf(concern),
    evidenceOf(feature, rel(proposalA.id, feature.id, "INTRODUCES"), 0.4)
  ];

  const introduceQuery =
    "What did PEP-484 introduce?";

  const equivalentIntroduceForms = [
    "PEP-484 introduced Typing.",
    "Type Hints introduced Typing.",
    "PEP-484 introduced the Typing feature.",
    "Type Hints introduced the Typing feature.",
    "Typing was introduced by PEP-484.",
    "Typing was introduced by Type Hints."
  ];

  it("A–E / R: equivalent INTRODUCES forms are all SUPPORTED", () => {
    const context =
      ctx(introduceQuery, bag);

    for (const answer of equivalentIntroduceForms) {
      expectSupported(answer, context);
    }

    const statuses =
      equivalentIntroduceForms.map(answer =>
        verify(answer, context).result.trace.meta?.verificationStatus
      );

    expect(new Set(statuses).size).toBe(1);
    expect(statuses[0]).toBe("SUPPORTED");
  });

  it("F: proposed-by alias/title form is SUPPORTED", () => {
    const context =
      ctx("Who proposed PEP-484?", bag);

    expectSupported(
      "Type Hints was proposed by Guido van Rossum.",
      context
    );
  });

  it("G: coordinated introduce+address for same subject is SUPPORTED", () => {
    const context =
      ctx(
        "What did PEP-484 introduce, and what concern did it address?",
        bag
      );

    expectSupported(
      "Type Hints introduced Typing and addressed Readability.",
      context
    );
  });

  it("H: CLAIM_SET alias resolution is SUPPORTED", () => {
    const query =
      "Who proposed PEP-484, what did it introduce, and what concern did it address?";

    const context =
      ctx(query, bag);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("CLAIM_SET");

    expectSupported(
      "Type Hints was proposed by Guido van Rossum. Type Hints introduced Typing. Type Hints addressed Readability.",
      context
    );
  });

  it("I: direct connected alias resolution is SUPPORTED", () => {
    const query =
      "How is PEP-484 connected to Typing?";

    const context =
      ctx(query, bag);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("DIRECT");

    expect(
      context.answerContext?.claimEvidence.some(claim =>
        claim.evidence.some(item => item.relationship?.type === "INTRODUCES")
      )
    ).toBe(true);

    expectSupported("Type Hints introduced Typing.", context);
  });

  it("J: bridge alias resolution is SUPPORTED", () => {
    const query =
      "How are PEP-526 and PEP-604 connected through Typing?";

    const context =
      ctx(query, bag);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("BRIDGE");

    expect(
      (context.answerContext?.claimEvidence.length ?? 0) >= 2
    ).toBe(true);

    expectSupported(
      "Variable Annotations introduced Typing. Union Syntax introduced Typing.",
      context
    );
  });

  it("K: wrong subject fails closed", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded(
        "PEP-526 introduced Typing.",
        context
      )
    ).toBe(false);
  });

  it("L: wrong predicate fails closed", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded(
        "Type Hints addresses Typing.",
        context
      )
    ).toBe(false);
  });

  it("M: wrong object fails closed", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded(
        "Type Hints introduced Readability.",
        context
      )
    ).toBe(false);
  });

  it("N: wrong bridge endpoint fails closed", () => {
    const query =
      "How are PEP-526 and PEP-604 connected through Typing?";

    const context =
      ctx(query, bag);

    const outcome =
      verify(
        "Variable Annotations introduced Typing. Protocols introduced Typing.",
        context
      );

    expect(outcome.result.trace.meta?.verificationStatus)
      .not.toBe("SUPPORTED");
  });

  it("O: object-only answer is rejected for typed relationship", () => {
    const context =
      ctx(introduceQuery, bag);

    expect(
      relationshipAttributionIsGrounded("Typing", context)
    ).toBe(false);

    expect(
      verify("Typing", context).result.trace.meta?.verificationStatus
    ).not.toBe("SUPPORTED");
  });

  it("P: claim order permutation stays SUPPORTED", () => {
    const query =
      "Who proposed PEP-484, what did it introduce, and what concern did it address?";

    const context =
      ctx(query, bag);

    expectSupported(
      "Type Hints addressed Readability. Type Hints was proposed by Guido van Rossum. Type Hints introduced Typing.",
      context
    );
  });

  it("Q: evidence order permutation stays SUPPORTED", () => {
    const context =
      ctx(introduceQuery, shuffle(bag));

    expectSupported("Type Hints introduced Typing.", context);
  });

  it("production-style stability: 10× repeated equivalent forms", () => {
    const cases: Array<{ query: string; answer: string }> = [
      {
        query: introduceQuery,
        answer: "Type Hints introduced the Typing feature."
      },
      {
        query: "Who proposed PEP-484?",
        answer: "Type Hints was proposed by Guido van Rossum."
      },
      {
        query: "How is PEP-484 connected to Typing?",
        answer: "Type Hints introduced Typing."
      },
      {
        query: "How are PEP-526 and PEP-604 connected through Typing?",
        answer:
          "Variable Annotations introduced Typing. Union Syntax introduced Typing."
      },
      {
        query:
          "Who proposed PEP-484, what did it introduce, and what concern did it address?",
        answer:
          "Type Hints was proposed by Guido van Rossum. Type Hints introduced Typing. Type Hints addressed Readability."
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
          `${entry.query}#${run}`
        ).toBe("SUPPORTED");
      }
    }
  });

});
