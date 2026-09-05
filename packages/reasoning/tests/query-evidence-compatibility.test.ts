import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  classifyEntityCompatibility,
  extractTopicCodes,
  filterCompatibleEvidence,
  isEntityCompatibleWithQuery
} from "../src/utils/query-evidence-compatibility.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

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
    source: "pep-484.md",
    confidence: 1,
    properties
  };
}

function evidenceOf(
  e: KnowledgeEntity,
  score = 0.95,
  relationship?: Evidence["relationship"]
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const pep484 = entity(
  "proposal:PEP-484",
  "Proposal",
  "Type Hints",
  { pep: "484" }
);

const typing = entity(
  "feature:typing",
  "Feature",
  "Typing"
);

const author = entity(
  "author:guido-van-rossum",
  "Author",
  "Guido van Rossum"
);

describe("query–evidence topic compatibility", () => {

  it("extracts coded topic identifiers generically", () => {
    expect(extractTopicCodes("What is PEP-484?")).toEqual([
      "pep484"
    ]);
    expect(extractTopicCodes("Compare RFC 822 and ISO-9001")).toEqual([
      "rfc822",
      "iso9001"
    ]);
    expect(extractTopicCodes("What are type hints?")).toEqual([]);
  });

  it("A: exact valid query keeps PEP-484 evidence", () => {
    expect(
      isEntityCompatibleWithQuery(
        "What is PEP-484?",
        pep484
      )
    ).toBe(true);

    expect(
      classifyEntityCompatibility(
        "What is PEP-484?",
        pep484
      ).kind
    ).toBe("exact_topic");

    const kept =
      filterCompatibleEvidence(
        "What is PEP-484?",
        [evidenceOf(pep484), evidenceOf(typing)]
      );

    expect(kept.map(item => item.entity.id)).toContain(
      "proposal:PEP-484"
    );
  });

  it("B: valid paraphrase keeps PEP-484 / Type Hints evidence", () => {
    expect(
      isEntityCompatibleWithQuery(
        "What are Type Hints?",
        pep484
      )
    ).toBe(true);

    expect(
      classifyEntityCompatibility(
        "Explain the Type Hints proposal",
        pep484
      ).kind
    ).toBe("paraphrase");

    expect(
      isEntityCompatibleWithQuery(
        "What is typing?",
        typing
      )
    ).toBe(true);
  });

  it("C: near-match wrong topic rejects PEP-484 for PEP-8", () => {
    expect(
      isEntityCompatibleWithQuery(
        "What is PEP-8?",
        pep484
      )
    ).toBe(false);

    expect(
      classifyEntityCompatibility(
        "What is PEP-8?",
        pep484
      )
    ).toEqual({
      kind: "unrelated",
      compatible: false
    });

    const kept =
      filterCompatibleEvidence(
        "What is PEP-8?",
        [
          evidenceOf(pep484, 0.99),
          evidenceOf(typing, 0.9),
          evidenceOf(author, 0.85)
        ]
      );

    expect(kept).toEqual([]);
  });

  it("coded wrong-topic complex queries cannot paraphrase-seed uncoded neighbors", () => {
    expect(
      isEntityCompatibleWithQuery(
        "Who proposed PEP-8, what feature did it introduce?",
        typing
      )
    ).toBe(false);

    const kept =
      filterCompatibleEvidence(
        "Who proposed PEP-8, what readability feature did it introduce, and why was it accepted?",
        [
          evidenceOf(pep484, 0.99),
          evidenceOf(typing, 0.9, {
            from: "proposal:PEP-484",
            to: "feature:typing",
            type: "INTRODUCES",
            confidence: 1
          }),
          evidenceOf(author, 0.85, {
            from: "proposal:PEP-484",
            to: "author:guido-van-rossum",
            type: "PROPOSED_BY",
            confidence: 1
          })
        ]
      );

    expect(kept).toEqual([]);
  });

  it("D: unrelated topic fails closed", () => {
    const kept =
      filterCompatibleEvidence(
        "What is the relationship between quantum computing and photosynthesis?",
        [
          evidenceOf(pep484, 0.8),
          evidenceOf(typing, 0.7)
        ]
      );

    expect(kept).toEqual([]);
  });

  it("keeps relationship-linked neighbors of a compatible seed", () => {
    const kept =
      filterCompatibleEvidence(
        "Who proposed PEP-484?",
        [
          evidenceOf(pep484, 0.9),
          evidenceOf(author, 0.95, {
            from: "proposal:PEP-484",
            to: "author:guido-van-rossum",
            type: "PROPOSED_BY",
            confidence: 1
          })
        ]
      );

    expect(kept.map(item => item.entity.id).sort()).toEqual([
      "author:guido-van-rossum",
      "proposal:PEP-484"
    ]);
  });

  it("does not keep neighbors when no seed is query-compatible", () => {
    const kept =
      filterCompatibleEvidence(
        "What is PEP-8?",
        [
          evidenceOf(pep484, 0.9),
          evidenceOf(author, 0.95, {
            from: "proposal:PEP-484",
            to: "author:guido-van-rossum",
            type: "PROPOSED_BY",
            confidence: 1
          })
        ]
      );

    expect(kept).toEqual([]);
  });

  it("grounding path fail-closes for PEP-8 with only PEP-484 evidence", async () => {
    const context =
      new DefaultContextBuilder().build({
        evidence: filterCompatibleEvidence(
          "What is PEP-8?",
          [evidenceOf(pep484, 0.99)]
        )
      });

    context.query = "What is PEP-8?";

    expect(context.evidence).toHaveLength(0);

    const generated =
      await new DefaultAnswerGenerator().generate(context);

    const verified =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(verified.result.answer).toBe("");
    expect(verified.result.confidence).toBe(0);
    expect(verified.result.citations).toEqual([]);
  });

  it("grounding path still answers exact PEP-484 queries", async () => {
    const filtered =
      filterCompatibleEvidence(
        "What is PEP-484?",
        [evidenceOf(pep484, 0.99)]
      );

    const context =
      new DefaultContextBuilder().build({
        evidence: filtered
      });

    context.query = "What is PEP-484?";

    const generated =
      await new DefaultAnswerGenerator().generate(context);

    const verified =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(verified.report.accepted).toBe(true);
    expect(verified.result.answer).toContain("Type Hints");
    expect(verified.result.citations[0]?.entityId).toBe(
      "proposal:PEP-484"
    );
  });

});
