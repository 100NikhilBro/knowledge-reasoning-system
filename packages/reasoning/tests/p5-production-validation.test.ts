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
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  interpretEvidencePaths
} from "../src/utils/interpret-path.js";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

function entity(
  id: string,
  type: string,
  label: string
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "pep-484.md",
    confidence: 1,
    properties: {}
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
  relationship?: KnowledgeRelationship
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

function ctx(
  query: string,
  evidence: Evidence[]
): ReasoningContext {
  const understanding =
    understandQuery(query);

  return {
    query,
    understanding,
    evidence,
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

const pep =
  entity("proposal:PEP-484", "Proposal", "Type Hints");

const typing =
  entity("feature:typing", "Feature", "Typing");

const readability =
  entity("concern:readability", "Concern", "Readability");

const guido =
  entity("author:guido", "Author", "Guido van Rossum");

const introduces =
  rel("INTRODUCES", pep.id, typing.id);

const addresses =
  rel("ADDRESSES", pep.id, readability.id);

const proposedBy =
  rel("PROPOSED_BY", pep.id, guido.id);

const compoundEvidence = [
  ev(guido, 0.95, proposedBy),
  ev(pep, 0.95, proposedBy),
  ev(typing, 0.9, introduces),
  ev(pep, 0.9, introduces),
  ev(readability, 0.9, addresses),
  ev(pep, 0.9, addresses)
];

const bridgeEvidence = [
  ev(typing, 0.9, introduces),
  ev(pep, 0.95, introduces),
  ev(readability, 0.85, addresses),
  ev(pep, 0.9, addresses)
];

describe("P5 production validation — five key queries", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("1. compound query — supported path + non-NONE confidence", async () => {
    const query =
      "Who proposed PEP-484, what did it introduce, and what concern did it address?";

    const context =
      ctx(query, compoundEvidence);

    const outcome =
      await verifier.verify({
        result: {
          answer:
            "Type Hints was proposed by Guido van Rossum. Type Hints introduced Typing. Type Hints addressed Readability.",
          confidence: 0.9,
          citations: compoundEvidence.map(item => ({
            entityId: item.entity.id,
            source: item.entity.source
          })),
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.confidenceLevel).not.toBe("NONE");
    expect(outcome.result.trace.meta?.intent).toBeDefined();
    expect(
      outcome.result.trace.steps.some(step =>
        /Confidence:/i.test(step.description)
      )
    ).toBe(true);
  });

  it("2. bridge query — BRIDGE interpretation + support", async () => {
    const query =
      "How are Typing and Readability connected through PEP-484?";

    const context =
      ctx(query, bridgeEvidence);

    const path =
      interpretEvidencePaths(query, context);

    expect(path.kind).toBe("BRIDGE");
    expect(path.supportsClaim).toBe(true);

    const outcome =
      await verifier.verify({
        result: {
          answer:
            "Typing and Readability are connected through Type Hints (PEP-484).",
          confidence: 0.9,
          citations: bridgeEvidence.map(item => ({
            entityId: item.entity.id,
            source: item.entity.source
          })),
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.trace.meta?.pathInterpretation?.kind)
      .toBe("BRIDGE");
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.confidenceLevel).not.toBe("NONE");
  });

  it("3. direct query with indirect path — INSUFFICIENT + NONE", async () => {
    const query =
      "How is Typing directly related to Readability?";

    const context =
      ctx(query, bridgeEvidence);

    const path =
      interpretEvidencePaths(query, context);

    expect(path.kind).toBe("INSUFFICIENT");
    expect(path.supportsClaim).toBe(false);

    const outcome =
      await verifier.verify({
        result: {
          answer:
            "Typing is directly related to Readability.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.confidenceLevel).toBe("NONE");
    expect(outcome.result.trace.meta?.pathInterpretation?.kind)
      .toBe("INSUFFICIENT");
    expect(outcome.result.answer).toMatch(/not established|does not establish|insufficient/i);
  });

  it("4. partial causal — not HIGH confidence", async () => {
    const query =
      "Why did PEP-484 introduce Typing to improve runtime performance?";

    const context =
      ctx(query, [
        ev(typing, 0.9, introduces),
        ev(pep, 0.9, introduces)
      ]);

    const outcome =
      await verifier.verify({
        result: {
          answer:
            "PEP-484 introduced Typing to improve runtime performance.",
          confidence: 0.95,
          citations: [
            {
              entityId: pep.id,
              source: pep.source
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/introduced Typing/i);
    expect(outcome.result.answer).toMatch(/does not establish|runtime/i);
    expect(outcome.result.confidenceLevel).not.toBe("HIGH");
    expect(outcome.result.confidence).toBeLessThan(1);
  });

  it("5. out-of-corpus / missing relationship — fail-closed NONE", async () => {
    const query =
      "What relationship does PEP-484 have with quantum computing, and what Python version implemented that relationship?";

    const context =
      ctx(query, [
        ev(pep, 0.4),
        ev(typing, 0.3)
      ]);

    const outcome =
      await verifier.verify({
        result: {
          answer:
            "PEP-484 enables quantum computing in Python 3.14.",
          confidence: 0.8,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.confidenceLevel).toBe("NONE");
    expect(outcome.result.answer).not.toMatch(/enables quantum computing/i);
  });

});
