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

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  executeAnalytical,
  formatAnalyticalAnswer,
  dedupeEvidenceByEntityId
} from "../src/utils/execute-analytical.js";

import {
  calibrateAnswerConfidence
} from "../src/utils/calibrate-confidence.js";

import {
  buildTrace
} from "../src/utils/trace-builder.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

function entity(
  id: string,
  type: string,
  label: string,
  properties: Record<string, unknown> = {},
  source = "pep-484.md"
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source,
    confidence: 1,
    properties
  };
}

function rel(
  type: string,
  from: string,
  to: string
): KnowledgeRelationship {
  return {
    type,
    from,
    to,
    confidence: 1,
    properties: {}
  };
}

function ev(
  e: KnowledgeEntity,
  score: number,
  relationship?: KnowledgeRelationship,
  metadata?: Record<string, unknown>
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {}),
    ...(metadata ? { metadata } : {})
  };
}

function ctx(
  query: string,
  evidence: Evidence[]
): ReasoningContext {
  const understanding =
    understandQuery(query);

  const analyticalResult =
    understanding.intent === "ANALYTICAL" &&
    understanding.analytical
      ? executeAnalytical(understanding.analytical, evidence)
      : undefined;

  return {
    query,
    understanding,
    evidence,
    ...(analyticalResult
      ? { analyticalResult }
      : {}),
    items: evidence.map(item => ({
      entityId: item.entity.id,
      entityType: item.entity.type,
      label: item.entity.label,
      source: item.entity.source,
      confidence: item.entity.confidence,
      score: item.score,
      evidenceSource: item.source,
      properties: item.entity.properties,
      ...(item.relationship
        ? { relationship: item.relationship }
        : {})
    })),
    budget: {
      maxEvidence: evidence.length,
      inputCount: evidence.length,
      retainedCount: evidence.length,
      truncated: false
    },
    config: { maxEvidence: evidence.length }
  };
}

const pep484 =
  entity("proposal:PEP-484", "Proposal", "Type Hints", { pep: "484" });

const pep526 =
  entity(
    "proposal:PEP-526",
    "Proposal",
    "Syntax for Variable Annotations",
    { pep: "526" },
    "pep-526.md"
  );

const pep544 =
  entity(
    "proposal:PEP-544",
    "Proposal",
    "Protocols",
    { pep: "544" },
    "pep-544.md"
  );

const typing =
  entity("feature:typing", "Feature", "Typing");

const readability =
  entity("concern:readability", "Concern", "Readability");

const introduces484 =
  rel("INTRODUCES", pep484.id, typing.id);

const introduces526 =
  rel("INTRODUCES", pep526.id, typing.id);

const addresses484 =
  rel("ADDRESSES", pep484.id, readability.id);

const typingCorpus: Evidence[] = [
  ev(pep484, 0.95, introduces484),
  ev(typing, 0.9, introduces484),
  ev(pep526, 0.9, introduces526),
  ev(typing, 0.85, introduces526),
  ev(pep544, 0.7),
  ev(readability, 0.8, addresses484),
  ev(pep484, 0.8, addresses484)
];

describe("P6 analytical / aggregation reasoning", () => {

  it("1. COUNT of grounded entities", () => {
    const understanding =
      understandQuery(
        "How many PEPs introduce typing-related features?"
      );

    expect(understanding.intent).toBe("ANALYTICAL");
    expect(understanding.analytical?.operation).toBe("COUNT");

    const result =
      executeAnalytical(
        understanding.analytical!,
        typingCorpus
      );

    expect(result.status).toBe("SUPPORTED");
    expect(result.value).toBe(2);
    expect(result.deduplicatedEntityIds).toEqual(
      expect.arrayContaining([
        "proposal:PEP-484",
        "proposal:PEP-526"
      ])
    );
  });

  it("2. DISTINCT COUNT with duplicate evidence channels", () => {
    const duplicates: Evidence[] = [
      ev(pep484, 0.9, introduces484, {
        sources: ["graph", "vector"]
      }),
      ev(pep484, 0.8, introduces484, {
        sources: ["vector"]
      }),
      {
        ...ev(pep484, 0.7, introduces484),
        source: "vector"
      },
      ev(typing, 0.9, introduces484)
    ];

    const understanding =
      understandQuery(
        "How many distinct PEPs introduce typing?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        duplicates
      );

    expect(result.operation).toBe("DISTINCT_COUNT");
    expect(result.value).toBe(1);
    expect(result.deduplicatedEntityIds).toEqual([
      "proposal:PEP-484"
    ]);
    expect(dedupeEvidenceByEntityId(duplicates)).toHaveLength(2);
  });

  it("3. LIST of grounded entities", () => {
    const understanding =
      understandQuery(
        "Which PEPs introduce typing-related features?"
      );

    expect(understanding.analytical?.operation).toBe("LIST");

    const result =
      executeAnalytical(
        understanding.analytical!,
        typingCorpus
      );

    expect(result.status).toBe("SUPPORTED");
    expect(result.matchedEntities.map(item => item.entityId).sort())
      .toEqual([
        "proposal:PEP-484",
        "proposal:PEP-526"
      ]);
  });

  it("4. EXISTS = true", () => {
    const understanding =
      understandQuery(
        "Are there any PEPs that address readability?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        typingCorpus
      );

    expect(result.operation).toBe("EXISTS");
    expect(result.status).toBe("SUPPORTED_EXISTS");
    expect(result.value).toBe(true);
  });

  it("5. EXISTS = false when corpus sample allows that conclusion", () => {
    const understanding =
      understandQuery(
        "Are there any PEPs that address readability?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        [
          ev(pep544, 0.8),
          ev(pep526, 0.7, introduces526),
          ev(typing, 0.7, introduces526)
        ]
      );

    expect(result.status).toBe("SUPPORTED_NOT_EXISTS");
    expect(result.value).toBe(false);
    expect(result.explanation).toMatch(/not a universal claim|among grounded/i);
  });

  it("6. EXISTS = insufficient when absence cannot prove non-existence", () => {
    const understanding =
      understandQuery(
        "Are there any PEPs that address readability?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        []
      );

    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("7. MIN with valid structured pep values", () => {
    const understanding =
      understandQuery(
        "What is the minimum PEP number among grounded PEPs?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        [
          ev(pep484, 0.9),
          ev(pep526, 0.8),
          ev(pep544, 0.7)
        ]
      );

    expect(result.operation).toBe("MIN");
    expect(result.status).toBe("SUPPORTED");
    expect(result.value).toBe(484);
    expect(result.matchedEntities[0]?.entityId).toBe("proposal:PEP-484");
  });

  it("8. MAX with valid structured pep values", () => {
    const understanding =
      understandQuery(
        "What is the maximum PEP number among grounded PEPs?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        [
          ev(pep484, 0.9),
          ev(pep526, 0.8),
          ev(pep544, 0.7)
        ]
      );

    expect(result.operation).toBe("MAX");
    expect(result.value).toBe(544);
  });

  it("9. unsupported MIN/MAX value", () => {
    const understanding =
      understandQuery(
        "What is the average number of authors per PEP?"
      );

    expect(understanding.analytical?.operation).toBe("AVG");

    const result =
      executeAnalytical(
        understanding.analytical!,
        typingCorpus
      );

    expect(result.status).toBe("NOT_SUPPORTED");
  });

  it("10. wrong entity type does not inflate PEP counts", () => {
    const understanding =
      understandQuery("How many PEPs are in the corpus?");

    const result =
      executeAnalytical(
        understanding.analytical!,
        [
          ev(typing, 0.9),
          ev(readability, 0.8),
          ev(pep484, 0.9)
        ]
      );

    expect(result.value).toBe(1);
    expect(result.deduplicatedEntityIds).toEqual([
      "proposal:PEP-484"
    ]);
  });

  it("11. wrong relationship filter yields zero matches", () => {
    const understanding =
      understandQuery(
        "How many PEPs address readability?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        [
          ev(pep526, 0.9, introduces526),
          ev(typing, 0.9, introduces526)
        ]
      );

    expect(result.value).toBe(0);
    expect(result.deduplicatedEntityIds).toEqual([]);
  });

  it("12. ambiguous analytical query fails closed", () => {
    const understanding =
      understandQuery("What is the most authors across PEPs?");

    expect(understanding.intent).toBe("ANALYTICAL");
    expect(understanding.analytical?.operation).toBe("UNKNOWN");

    const result =
      executeAnalytical(
        understanding.analytical!,
        typingCorpus
      );

    expect(result.status).toBe("NOT_SUPPORTED");
  });

  it("13. empty retrieval → INSUFFICIENT_EVIDENCE (not zero)", () => {
    const understanding =
      understandQuery("How many PEPs introduce typing?");

    const result =
      executeAnalytical(
        understanding.analytical!,
        []
      );

    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.value).toBeUndefined();
  });

  it("14. multi-document analytical query", () => {
    const understanding =
      understandQuery(
        "Which PEPs introduce typing-related features?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        typingCorpus
      );

    const sources =
      new Set(
        result.matchedEntities.map(item => item.source)
      );

    expect(sources.size).toBeGreaterThan(1);
    expect(sources.has("pep-484.md")).toBe(true);
    expect(sources.has("pep-526.md")).toBe(true);
  });

  it("15. vector + graph duplicate evidence counted once", () => {
    const understanding =
      understandQuery(
        "How many PEPs introduce typing-related features?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        [
          ev(pep484, 0.95, introduces484, {
            sources: ["graph"]
          }),
          {
            ...ev(pep484, 0.91, introduces484, {
              sources: ["vector"]
            }),
            source: "vector"
          },
          ev(typing, 0.9, introduces484)
        ]
      );

    expect(result.value).toBe(1);
  });

  it("16. generated answer contradicts analytical result", async () => {
    const query =
      "How many PEPs introduce typing-related features?";

    const context =
      ctx(query, typingCorpus);

    expect(context.analyticalResult?.value).toBe(2);

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      await verifier.verify({
        result: {
          answer: "There are 7 PEPs that introduce typing.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/:\s*2\b|Count of distinct/);
    expect(outcome.result.answer).not.toMatch(/\b7\b/);
    expect(outcome.result.trace.meta?.analytical?.value).toBe(2);
  });

  it("17. unsupported global-scope claim stays corpus-scoped", () => {
    const understanding =
      understandQuery(
        "How many PEPs introduce typing-related features?"
      );

    const result =
      executeAnalytical(
        understanding.analytical!,
        typingCorpus
      );

    expect(result.scope).toBe("current grounded corpus");
    expect(formatAnalyticalAnswer(result)).toMatch(
      /current grounded corpus/
    );
    expect(formatAnalyticalAnswer(result)).not.toMatch(
      /entire Python ecosystem|all PEPs ever/
    );
  });

  it("18. insufficient analytical cannot become HIGH confidence", () => {
    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: { evidence: typingCorpus },
        intent: "ANALYTICAL",
        analyticalStatus: "INSUFFICIENT_EVIDENCE",
        verificationStatus: "NOT_SUPPORTED"
      });

    expect(calibrated.level).toBe("NONE");
    expect(calibrated.score).toBe(0);
  });

  it("19. trace contains analytical operation and matched inputs", () => {
    const query =
      "How many PEPs introduce typing-related features?";

    const context =
      ctx(query, typingCorpus);

    const trace =
      buildTrace(
        { evidence: context.evidence },
        {
          query,
          context,
          verificationStatus: "SUPPORTED"
        }
      );

    expect(trace.meta?.intent).toBe("ANALYTICAL");
    expect(trace.meta?.analytical?.operation).toBe("COUNT");
    expect(trace.meta?.analytical?.deduplicatedEntityIds).toEqual(
      expect.arrayContaining([
        "proposal:PEP-484",
        "proposal:PEP-526"
      ])
    );
    expect(
      trace.steps.some(step =>
        /Analytical: COUNT/i.test(step.description)
      )
    ).toBe(true);
  });

  it("20. confidence + verification integration for supported count", async () => {
    const query =
      "How many PEPs introduce typing-related features?";

    const context =
      ctx(query, typingCorpus);

    const answer =
      formatAnalyticalAnswer(context.analyticalResult!);

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      await verifier.verify({
        result: {
          answer,
          confidence: 0.9,
          citations: context.items.map(item => ({
            entityId: item.entityId,
            source: item.source
          })),
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.confidenceLevel).not.toBe("NONE");
    expect(outcome.result.trace.meta?.analytical?.value).toBe(2);
    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

});
