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
  executeSummarization,
  groupEvidenceByDocument,
  formatSummarizationAnswer,
  detectSummarizationContradiction
} from "../src/utils/execute-summarization.js";

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
  source: string,
  properties: Record<string, unknown> = {}
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

  const summarizationResult =
    understanding.intent === "SUMMARIZATION" &&
    understanding.summarization
      ? executeSummarization(
          understanding.summarization,
          evidence,
          {
            query,
            includeAnalyticalCount:
              /\bhow many\b|\bcount\b/i.test(query)
          }
        )
      : undefined;

  return {
    query,
    understanding,
    evidence,
    ...(summarizationResult
      ? { summarizationResult }
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
  entity(
    "proposal:PEP-484",
    "Proposal",
    "Type Hints",
    "pep-484.md",
    { pep: "484" }
  );

const pep526 =
  entity(
    "proposal:PEP-526",
    "Proposal",
    "Variable Annotations",
    "pep-526.md",
    { pep: "526" }
  );

const typing =
  entity("feature:typing", "Feature", "Typing", "pep-484.md");

const typing526 =
  entity("feature:typing", "Feature", "Typing", "pep-526.md");

const readability =
  entity(
    "concern:readability",
    "Concern",
    "Readability",
    "pep-484.md"
  );

const introduces484 =
  rel("INTRODUCES", pep484.id, typing.id);

const introduces526 =
  rel("INTRODUCES", pep526.id, typing526.id);

const addresses484 =
  rel("ADDRESSES", pep484.id, readability.id);

const multiDocEvidence: Evidence[] = [
  ev(pep484, 0.95, introduces484),
  ev(typing, 0.9, introduces484),
  ev(pep484, 0.85, addresses484),
  ev(readability, 0.8, addresses484),
  ev(pep526, 0.9, introduces526),
  ev(typing526, 0.85, introduces526)
];

describe("P7 cross-document summarization / synthesis", () => {

  it("1. single-document summary", () => {
    const understanding =
      understandQuery("Summarize the PEPs related to typing.");

    expect(understanding.intent).toBe("SUMMARIZATION");

    const result =
      executeSummarization(
        understanding.summarization!,
        [
          ev(pep484, 0.9, introduces484),
          ev(typing, 0.9, introduces484)
        ]
      );

    expect(result.mode).toBe("SINGLE_DOCUMENT_SUMMARY");
    expect(result.documentCount).toBe(1);
    expect(result.status).toBe("SUPPORTED");
  });

  it("2. true cross-document summary", () => {
    const understanding =
      understandQuery(
        "Summarize how the PEPs in this corpus evolved typing-related features."
      );

    const result =
      executeSummarization(
        understanding.summarization!,
        multiDocEvidence,
        { query: understanding.originalQuery }
      );

    expect(result.mode).toBe("CROSS_DOCUMENT_SYNTHESIS");
    expect(result.documentCount).toBe(2);
    expect(result.status).toBe("SUPPORTED");
  });

  it("3. multiple documents with shared entity", () => {
    const result =
      executeSummarization(
        understandQuery(
          "Summarize the PEPs related to typing across the corpus."
        ).summarization!,
        multiDocEvidence
      );

    expect(
      result.sharedEntities.some(item => item.id === "feature:typing")
    ).toBe(true);
    expect(
      result.crossDocumentRelations.every(item => item.grounded)
    ).toBe(true);
    expect(
      result.crossDocumentRelations.some(item =>
        /synthetic document-to-document edge/i.test(item.description)
      )
    ).toBe(true);
  });

  it("4. duplicate evidence across graph/vector channels", () => {
    const evidence: Evidence[] = [
      ev(pep484, 0.95, introduces484, { sources: ["graph"] }),
      {
        ...ev(pep484, 0.9, introduces484, { sources: ["vector"] }),
        source: "vector"
      },
      ev(typing, 0.9, introduces484)
    ];

    const groups =
      groupEvidenceByDocument(evidence);

    expect(groups).toHaveLength(1);
    expect(
      groups[0].entities.filter(item => item.id === "proposal:PEP-484")
    ).toHaveLength(1);
  });

  it("5. unsupported document invented by generator", () => {
    const result =
      executeSummarization(
        understandQuery("Summarize the PEPs related to typing.")
          .summarization!,
        [
          ev(pep484, 0.9, introduces484),
          ev(typing, 0.9, introduces484)
        ]
      );

    expect(
      detectSummarizationContradiction(
        "PEP-999.md also introduced typing.",
        result
      )
    ).toMatch(/invents/i);
  });

  it("6. unsupported relationship invented by generator", async () => {
    const context =
      ctx(
        "Summarize the PEPs related to typing across the corpus.",
        multiDocEvidence
      );

    const outcome =
      await new DefaultAnswerVerifier().verify({
        result: {
          answer:
            "PEP-484 is RELATED_TO PEP-526 because both mention Typing and PEP-484 led to PEP-526.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).not.toMatch(/led to PEP-526/i);
    expect(outcome.result.answer).toMatch(/Within the available corpus/i);
  });

  it("7. unsupported causality", () => {
    const result =
      executeSummarization(
        understandQuery(
          "Summarize how these PEPs evolved typing features."
        ).summarization!,
        multiDocEvidence,
        {
          query:
            "Summarize how these PEPs evolved typing features."
        }
      );

    expect(
      result.unsupportedGaps.some(gap =>
        /chronolog|causal/i.test(gap)
      )
    ).toBe(true);

    expect(
      detectSummarizationContradiction(
        "PEP-484 caused PEP-526.",
        result
      )
    ).toMatch(/causality/i);
  });

  it("8. unsupported chronology", () => {
    const result =
      executeSummarization(
        understandQuery(
          "Summarize the evolution of typing across indexed PEPs."
        ).summarization!,
        multiDocEvidence,
        {
          query:
            "Summarize the evolution of typing across indexed PEPs."
        }
      );

    expect(
      detectSummarizationContradiction(
        "PEP-484 chronologically followed into PEP-526.",
        result
      )
    ).toMatch(/chronolog|evolution/i);
  });

  it("9. incomplete corpus scope", () => {
    const result =
      executeSummarization(
        understandQuery("Summarize the PEPs related to typing.")
          .summarization!,
        [
          ev(pep484, 0.9, introduces484),
          ev(typing, 0.9, introduces484)
        ]
      );

    expect(result.scope).toBe("current grounded corpus");
    expect(formatSummarizationAnswer(result)).toMatch(
      /Within the available corpus/
    );
    expect(formatSummarizationAnswer(result)).not.toMatch(
      /entire Python ecosystem/
    );
  });

  it("10. no relevant evidence", () => {
    const result =
      executeSummarization(
        understandQuery("Summarize the PEPs related to typing.")
          .summarization!,
        []
      );

    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.documentCount).toBe(0);
  });

  it("11. only one document available for cross-document query", () => {
    const result =
      executeSummarization(
        understandQuery(
          "Summarize how typing evolved across indexed PEPs."
        ).summarization!,
        [
          ev(pep484, 0.9, introduces484),
          ev(typing, 0.9, introduces484)
        ]
      );

    expect(result.requestedMode).toBe("CROSS_DOCUMENT_SYNTHESIS");
    expect(result.mode).toBe("SINGLE_DOCUMENT_SUMMARY");
    expect(result.status).toBe("PARTIALLY_SUPPORTED");
    expect(
      result.unsupportedGaps.some(gap =>
        /only one grounded source document/i.test(gap)
      )
    ).toBe(true);
  });

  it("12. contradictory/different grounded evidence", () => {
    const result =
      executeSummarization(
        understandQuery(
          "Summarize the PEPs related to typing across the corpus."
        ).summarization!,
        multiDocEvidence
      );

    expect(result.differences.length).toBeGreaterThan(0);
    expect(formatSummarizationAnswer(result)).toMatch(
      /Document differences/i
    );
  });

  it("13. summary claim coverage", () => {
    const result =
      executeSummarization(
        understandQuery("Summarize the PEPs related to typing.")
          .summarization!,
        [
          ev(pep484, 0.9, introduces484),
          ev(typing, 0.9, introduces484)
        ]
      );

    expect(
      result.claims.every(claim => claim.status === "SUPPORTED")
    ).toBe(true);
    expect(
      result.claims.some(claim =>
        /INTRODUCES/i.test(claim.text)
      )
    ).toBe(true);
  });

  it("14. confidence integration", () => {
    const none =
      calibrateAnswerConfidence({
        evidenceSet: { evidence: [] },
        intent: "SUMMARIZATION",
        summarizationStatus: "INSUFFICIENT_EVIDENCE"
      });

    expect(none.level).toBe("NONE");

    const partial =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [
            ev(pep484, 0.9, introduces484),
            ev(typing, 0.9, introduces484)
          ]
        },
        intent: "SUMMARIZATION",
        summarizationStatus: "PARTIALLY_SUPPORTED",
        verificationStatus: "PARTIALLY_SUPPORTED"
      });

    expect(partial.level).not.toBe("HIGH");
  });

  it("15. trace integration", () => {
    const query =
      "Summarize the PEPs related to typing across the corpus.";

    const context =
      ctx(query, multiDocEvidence);

    const trace =
      buildTrace(
        { evidence: context.evidence },
        {
          query,
          context,
          verificationStatus: "SUPPORTED"
        }
      );

    expect(trace.meta?.intent).toBe("SUMMARIZATION");
    expect(trace.meta?.summarization?.documentCount).toBe(2);
    expect(trace.meta?.summarization?.documents).toEqual(
      expect.arrayContaining(["pep-484.md", "pep-526.md"])
    );
    expect(
      trace.steps.some(step =>
        /Summarization:/i.test(step.description)
      )
    ).toBe(true);
  });

  it("16. analytical value in summary remains deterministic", () => {
    const understanding =
      understandQuery(
        "Summarize the PEPs related to typing across the corpus."
      );

    expect(understanding.intent).toBe("SUMMARIZATION");

    const result =
      executeSummarization(
        understanding.summarization!,
        multiDocEvidence,
        {
          query: understanding.originalQuery,
          includeAnalyticalCount: true
        }
      );

    expect(result.analytical).toBeDefined();
    expect(typeof result.analytical?.value).toBe("number");
    expect(formatSummarizationAnswer(result)).toMatch(
      /Analytical COUNT \(deterministic\):/
    );
  });

  it("17. graph bridge semantics preserved (no synthetic PEP edge)", () => {
    const result =
      executeSummarization(
        understandQuery(
          "Summarize the PEPs related to typing across the corpus."
        ).summarization!,
        multiDocEvidence
      );

    expect(
      result.claims.some(claim =>
        /PEP-484.*RELATED_TO.*PEP-526|PEP-484 → RELATED → PEP-526/i
          .test(claim.text)
      )
    ).toBe(false);
  });

  it("18. entity provenance preserved", () => {
    const result =
      executeSummarization(
        understandQuery(
          "Summarize the PEPs related to typing across the corpus."
        ).summarization!,
        multiDocEvidence
      );

    for (const group of result.groups) {
      expect(group.documentId).toMatch(/\.md$/);
      expect(group.entities.length).toBeGreaterThan(0);
      expect(
        group.facts.every(fact => fact.length > 0)
      ).toBe(true);
    }
  });

  it("19. generated summary contradicts deterministic synthesis", async () => {
    const context =
      ctx(
        "Summarize the PEPs related to typing across the corpus.",
        multiDocEvidence
      );

    const outcome =
      await new DefaultAnswerVerifier().verify({
        result: {
          answer:
            "Across the entire Python ecosystem, PEP-999 globally caused typing.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/Within the available corpus/i);
    expect(outcome.result.answer).not.toMatch(/PEP-999|entire Python ecosystem/i);
    expect(outcome.result.trace.meta?.summarization?.documentCount)
      .toBe(2);
  });

  it("20. P0–P6 regression smoke: ANALYTICAL still classifies", () => {
    expect(
      understandQuery(
        "How many PEPs introduce typing-related features?"
      ).intent
    ).toBe("ANALYTICAL");

    expect(
      understandQuery(
        "Summarize the PEPs related to typing."
      ).intent
    ).toBe("SUMMARIZATION");
  });

});
