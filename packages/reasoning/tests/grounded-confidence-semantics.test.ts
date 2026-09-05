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
  DefaultConfidenceEngine
} from "../src/services/confidence-engine.service.js";

import {
  clampUnitInterval,
  computeGroundedAnswerConfidence,
  computePartialGroundedConfidence
} from "../src/utils/compute-grounded-confidence.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

function entity(
  id: string,
  label: string,
  confidence = 1
): KnowledgeEntity {
  return {
    id,
    type: "Proposal",
    label,
    source: `${id}.md`,
    confidence,
    properties: {}
  };
}

function evidenceOf(
  e: KnowledgeEntity,
  score: number
): Evidence {
  return {
    entity: e,
    score,
    source: "graph"
  };
}

describe("grounded answer confidence semantics", () => {

  const engine =
    new DefaultConfidenceEngine();

  it("returns 0 for empty evidence (fail-closed)", async () => {
    expect(
      await engine.calculate({ evidence: [] })
    ).toBe(0);
    expect(
      computeGroundedAnswerConfidence({ evidence: [] })
    ).toBe(0);
  });

  it("A: strongly grounded answer confidence is in [0,1]", async () => {
    const confidence =
      await engine.calculate({
        evidence: [
          evidenceOf(
            entity("proposal:PEP-484", "Type Hints", 1),
            6.25
          )
        ]
      });

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
    expect(confidence).toBe(1);
  });

  it("B: unbounded retrieval scores are not surfaced as confidence", async () => {
    const confidence =
      await engine.calculate({
        evidence: [
          evidenceOf(
            entity("proposal:PEP-484", "Type Hints", 1),
            15.5
          ),
          evidenceOf(
            entity("feature:typing", "Typing", 1),
            8.2
          )
        ]
      });

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
    expect(confidence).not.toBe(15.5);
    expect(confidence).not.toBe((15.5 + 8.2) / 2);
  });

  it("C: weak entity quality yields low confidence", async () => {
    const confidence =
      await engine.calculate({
        evidence: [
          evidenceOf(
            entity("weak:1", "Weak", 0.2),
            99
          )
        ]
      });

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(0.3);
    expect(confidence).toBeLessThan(0.5);
  });

  it("D: verification failure / unsupported path cannot keep falsely high confidence", async () => {
    const context =
      new DefaultContextBuilder().build({
        evidence: [
          evidenceOf(
            entity("proposal:PEP-484", "Type Hints", 1),
            12
          )
        ]
      });

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer:
            "Quantum computing invented PEP-999 with certainty.",
          confidence: 0.99,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "proposal:PEP-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThanOrEqual(0);
    expect(outcome.result.confidence).toBeLessThanOrEqual(1);
    expect(outcome.result.confidence).toBeLessThan(0.99);
    expect(outcome.result.answer).not.toMatch(/Quantum|PEP-999/i);
  });

  it("empty context verification forces confidence 0", () => {
    const context =
      new DefaultContextBuilder().build({
        evidence: []
      });

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer: "Invented",
          confidence: 0.99,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toBe("");
  });

  it("accepted grounded generation exposes unit-interval confidence", async () => {
    const context =
      new DefaultContextBuilder().build({
        evidence: [
          evidenceOf(
            entity("proposal:PEP-484", "Type Hints", 1),
            6.25
          )
        ]
      });

    const generated =
      await new DefaultAnswerGenerator().generate(context);

    const verified =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(verified.report.accepted).toBe(true);
    expect(verified.result.confidence).toBeGreaterThan(0);
    expect(verified.result.confidence).toBeLessThanOrEqual(1);
    expect(verified.result.confidence).toBe(
      computeGroundedAnswerConfidence({
        evidence: context.evidence
      })
    );
  });

  it("partial confidence is strictly below full grounded confidence", () => {
    const set = {
      evidence: [
        evidenceOf(
          entity("proposal:PEP-484", "Type Hints", 1),
          6.25
        )
      ]
    };

    const full =
      computeGroundedAnswerConfidence(set);
    const partial =
      computePartialGroundedConfidence(set);

    expect(partial).toBeLessThan(full);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThanOrEqual(1);
  });

  it("clampUnitInterval bounds non-unit values", () => {
    expect(clampUnitInterval(-1)).toBe(0);
    expect(clampUnitInterval(0)).toBe(0);
    expect(clampUnitInterval(0.42)).toBe(0.42);
    expect(clampUnitInterval(1)).toBe(1);
    expect(clampUnitInterval(6.25)).toBe(1);
    expect(clampUnitInterval(Number.NaN)).toBe(0);
  });

});
