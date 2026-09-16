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

/**
 * P1 — Broken Verification Layer
 *
 * Synthetic entities only. Verifies bound ClaimEvidence + NL alias tolerance
 * without LLM involvement. No corpus-specific hardcoded alias tables.
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
    const j = (i * 31 + 13) % (i + 1);
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

function expectNotSupported(
  answer: string,
  context: ReasoningContext
): void {
  const outcome =
    verify(answer, context);

  expect(
    outcome.result.trace.meta?.verificationStatus,
    `reject:${answer}`
  ).not.toBe("SUPPORTED");
}

describe("P1 verification layer — synthetic fixtures", () => {

  const feature =
    entity("feature:y", "Feature", "FeatureY");
  const author =
    entity("author:y", "Author", "AuthorY");
  const concern =
    entity("concern:z", "Concern", "ConcernZ");

  /*
   * Query tokens use EntityAlpha / EntityBeta so focus resolution is stable.
   * Title aliases live only in entity metadata (label/title/code).
   */
  const proposalAlpha =
    entity("proposal:alpha", "Proposal", "EntityAlpha", {
      code: "ALPHA",
      title: "Example Proposal"
    });
  const proposalBeta =
    entity("proposal:beta", "Proposal", "EntityBeta", {
      code: "BETA",
      title: "Companion Proposal"
    });
  const proposalGamma =
    entity("proposal:gamma", "Proposal", "EntityGamma", {
      code: "GAMMA",
      title: "Foreign Proposal"
    });

  const namedCorpus: Evidence[] = [
    evidenceOf(proposalAlpha, rel(proposalAlpha.id, feature.id, "INTRODUCES")),
    evidenceOf(proposalAlpha, rel(proposalAlpha.id, author.id, "PROPOSED_BY")),
    evidenceOf(proposalAlpha, rel(proposalAlpha.id, concern.id, "ADDRESSES")),
    evidenceOf(proposalBeta, rel(proposalBeta.id, feature.id, "INTRODUCES")),
    evidenceOf(proposalGamma, rel(proposalGamma.id, feature.id, "INTRODUCES")),
    evidenceOf(proposalAlpha),
    evidenceOf(proposalBeta),
    evidenceOf(proposalGamma),
    evidenceOf(feature),
    evidenceOf(author),
    evidenceOf(concern)
  ];

  const introduceQuery =
    "What did EntityAlpha introduce?";

  it("A: valid canonical S-P-O", () => {
    const context =
      ctx(introduceQuery, namedCorpus);

    expectSupported("EntityAlpha introduced FeatureY.", context);
  });

  it("B/C/D/T/U: subject alias, object alias, title, descriptive phrase", () => {
    expect(normalizeEntityPhrase("the FeatureY feature")).toBe("FeatureY");
    expect(normalizeEntityPhrase("the Example Proposal proposal"))
      .toBe("Example Proposal");

    const context =
      ctx(introduceQuery, namedCorpus);

    const forms = [
      "EntityAlpha introduced FeatureY.",
      "Example Proposal introduced FeatureY.",
      "EntityAlpha introduced the FeatureY feature.",
      "Example Proposal introduced the FeatureY feature."
    ];

    for (const answer of forms) {
      expectSupported(answer, context);
    }

    expect(
      new Set(
        forms.map(answer =>
          verify(answer, context).result.trace.meta?.verificationStatus
        )
      ).size
    ).toBe(1);
  });

  it("E/F: passive and active INTRODUCES / PROPOSED_BY", () => {
    const introduce =
      ctx(introduceQuery, namedCorpus);

    expectSupported(
      "FeatureY was introduced by EntityAlpha.",
      introduce
    );
    expectSupported(
      "FeatureY was introduced by Example Proposal.",
      introduce
    );

    const proposed =
      ctx("Who proposed EntityAlpha?", namedCorpus);

    expectSupported(
      "EntityAlpha was proposed by AuthorY.",
      proposed
    );
    expectSupported(
      "Example Proposal was proposed by AuthorY.",
      proposed
    );
    expectSupported(
      "AuthorY proposed EntityAlpha.",
      proposed
    );
    expectSupported(
      "AuthorY proposed Example Proposal.",
      proposed
    );
  });

  it("G: coordinated clauses", () => {
    const context =
      ctx(
        "What did EntityAlpha introduce, and what concern did it address?",
        namedCorpus
      );

    expectSupported(
      "Example Proposal introduced FeatureY and addressed ConcernZ.",
      context
    );
  });

  it("H: compound CLAIM_SET", () => {
    const query =
      "Who proposed EntityAlpha, what did it introduce, and what concern did it address?";

    const context =
      ctx(query, namedCorpus);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("CLAIM_SET");

    expectSupported(
      "Example Proposal was proposed by AuthorY. Example Proposal introduced FeatureY. Example Proposal addressed ConcernZ.",
      context
    );
  });

  it("I: connected relationship with alias", () => {
    const query =
      "How is EntityAlpha connected to FeatureY?";

    const context =
      ctx(query, namedCorpus);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("DIRECT");

    expect(
      (context.answerContext?.claimEvidence.length ?? 0) > 0
    ).toBe(true);

    expectSupported("Example Proposal introduced FeatureY.", context);
  });

  it("J: bridge with aliases", () => {
    const query =
      "How are EntityAlpha and EntityBeta connected through FeatureY?";

    const context =
      ctx(query, namedCorpus);

    expect(
      interpretEvidencePaths(query, context, context.understanding).kind
    ).toBe("BRIDGE");

    expectSupported(
      "Example Proposal introduced FeatureY. Companion Proposal introduced FeatureY.",
      context
    );
  });

  it("K: wrong subject fails", () => {
    const context =
      ctx(introduceQuery, namedCorpus);

    expect(
      relationshipAttributionIsGrounded(
        "EntityBeta introduced FeatureY.",
        context
      )
    ).toBe(false);
    expectNotSupported("EntityBeta introduced FeatureY.", context);
  });

  it("L: wrong predicate fails", () => {
    const context =
      ctx(introduceQuery, namedCorpus);

    expect(
      relationshipAttributionIsGrounded(
        "EntityAlpha addresses FeatureY.",
        context
      )
    ).toBe(false);
  });

  it("M: wrong object fails", () => {
    const context =
      ctx(introduceQuery, namedCorpus);

    expect(
      relationshipAttributionIsGrounded(
        "EntityAlpha introduced ConcernZ.",
        context
      )
    ).toBe(false);
  });

  it("N: wrong direction fails", () => {
    const context =
      ctx(introduceQuery, namedCorpus);

    expect(
      relationshipAttributionIsGrounded(
        "FeatureY introduced EntityAlpha.",
        context
      )
    ).toBe(false);
    expectNotSupported("FeatureY introduced EntityAlpha.", context);
  });

  it("O: wrong bridge endpoint fails", () => {
    const query =
      "How are EntityAlpha and EntityBeta connected through FeatureY?";

    const context =
      ctx(query, namedCorpus);

    expectNotSupported(
      "Example Proposal introduced FeatureY. Foreign Proposal introduced FeatureY.",
      context
    );
  });

  it("P/Q: object-only and subject-only relationship answers do not vacuous-pass", () => {
    const introduce =
      ctx(introduceQuery, namedCorpus);

    expect(relationshipAttributionIsGrounded("FeatureY", introduce))
      .toBe(false);
    expectNotSupported("FeatureY", introduce);

    const proposed =
      ctx("Who proposed EntityAlpha?", namedCorpus);

    expect(relationshipAttributionIsGrounded("AuthorY", proposed))
      .toBe(false);
    expectNotSupported("AuthorY", proposed);
  });

  it("R/S: evidence-order and claim-order permutations", () => {
    const introduce =
      ctx(introduceQuery, shuffle(namedCorpus));

    expectSupported("Example Proposal introduced FeatureY.", introduce);

    const compound =
      ctx(
        "Who proposed EntityAlpha, what did it introduce, and what concern did it address?",
        namedCorpus
      );

    expectSupported(
      "Example Proposal addressed ConcernZ. Example Proposal was proposed by AuthorY. Example Proposal introduced FeatureY.",
      compound
    );
  });

  it("V: status monotonicity — no SUPPORTED then attribution mismatch", () => {
    const context =
      ctx(introduceQuery, namedCorpus);

    const good =
      verify("Example Proposal introduced FeatureY.", context);

    const bad =
      verify("FeatureY introduced EntityAlpha.", context);

    const goodSteps =
      good.result.trace.steps.map(s => s.description).join("\n");
    const badSteps =
      bad.result.trace.steps.map(s => s.description).join("\n");

    expect(good.result.trace.meta?.verificationStatus).toBe("SUPPORTED");
    expect(goodSteps).not.toMatch(/attribution mismatch/i);

    expect(bad.result.trace.meta?.verificationStatus).toBe("NOT_SUPPORTED");
    expect(badSteps).toMatch(/attribution mismatch/i);
    expect(badSteps).not.toMatch(
      /Verification: SUPPORTED — answer accepted/
    );
  });

  it("W: unsupported causal inference remains fail-closed", () => {
    const context =
      ctx(introduceQuery, namedCorpus);

    expectNotSupported(
      "EntityAlpha introduced FeatureY specifically because FeatureY was needed to improve ConcernZ.",
      context
    );
  });

  it("Fixture 1–4 production-like stability (10×)", () => {
    const cases: Array<{ query: string; answer: string }> = [
      {
        query: introduceQuery,
        answer: "Example Proposal introduced the FeatureY feature."
      },
      {
        query: "Who proposed EntityAlpha?",
        answer: "AuthorY proposed Example Proposal."
      },
      {
        query: "How is EntityAlpha connected to FeatureY?",
        answer: "Example Proposal introduced FeatureY."
      },
      {
        query:
          "How are EntityAlpha and EntityBeta connected through FeatureY?",
        answer:
          "Example Proposal introduced FeatureY. Companion Proposal introduced FeatureY."
      },
      {
        query:
          "Who proposed EntityAlpha, what did it introduce, and what concern did it address?",
        answer:
          "Example Proposal was proposed by AuthorY. Example Proposal introduced FeatureY. Example Proposal addressed ConcernZ."
      }
    ];

    for (const entry of cases) {
      const context =
        ctx(entry.query, namedCorpus);

      for (let run = 0; run < 10; run++) {
        expect(
          verify(entry.answer, context).result.trace.meta?.verificationStatus,
          `${entry.query}#${run}`
        ).toBe("SUPPORTED");
      }
    }
  });

});
