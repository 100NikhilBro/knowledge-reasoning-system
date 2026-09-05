import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  DefaultEvidenceCollector
} from "../src/services/evidence-collector.service.js";

import {
  filterCompatibleEvidence
} from "../src/utils/query-evidence-compatibility.js";

import {
  computeGroundedAnswerConfidence
} from "../src/utils/compute-grounded-confidence.js";

function entity(
  id: string,
  label: string,
  properties: Record<string, unknown> = {}
): KnowledgeEntity {
  return {
    id,
    type: "Proposal",
    label,
    source: "pep.md",
    confidence: 1,
    properties
  };
}

describe("hybrid retrieval grounding integration", () => {

  it("D: wrong-topic vector evidence is filtered before grounding", async () => {
    const retrieval = {
      retrieve: vi.fn(async () => [
        {
          entity: entity("proposal:PEP-484", "Type Hints", {
            pep: "484"
          }),
          score: 0.93,
          source: "vector" as const,
          metadata: { sources: ["vector"], vectorScore: 0.93 }
        }
      ])
    };

    const collector =
      new DefaultEvidenceCollector(retrieval as never);

    const collected =
      await collector.collect({
        query: "What is PEP-8?"
      });

    expect(collected.evidence).toEqual([]);
  });

  it("E: wrong-topic graph evidence is filtered before grounding", async () => {
    const retrieval = {
      retrieve: vi.fn(async () => [
        {
          entity: entity("proposal:PEP-484", "Type Hints", {
            pep: "484"
          }),
          score: 0.9,
          source: "graph" as const,
          metadata: { sources: ["graph"], graphScore: 12 }
        }
      ])
    };

    const collector =
      new DefaultEvidenceCollector(retrieval as never);

    const collected =
      await collector.collect({
        query: "What is PEP-8?"
      });

    expect(collected.evidence).toEqual([]);
  });

  it("preserves hybrid provenance metadata on compatible seeds", async () => {
    const retrieval = {
      retrieve: vi.fn(async () => [
        {
          entity: entity("proposal:PEP-484", "Type Hints", {
            pep: "484"
          }),
          score: 0.85,
          source: "graph" as const,
          metadata: {
            sources: ["graph", "vector"],
            graphScore: 6,
            vectorScore: 0.8
          }
        }
      ])
    };

    const collector =
      new DefaultEvidenceCollector(retrieval as never);

    const collected =
      await collector.collect({
        query: "What is PEP-484?"
      });

    expect(collected.evidence).toHaveLength(1);
    expect(collected.evidence[0]?.metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);
  });

  it("H: confidence stays in [0,1] for hybrid-ranked evidence", () => {
    const evidence: Evidence[] = [
      {
        entity: entity("proposal:PEP-484", "Type Hints", {
          pep: "484"
        }),
        score: 0.92,
        source: "graph",
        metadata: {
          sources: ["graph", "vector"],
          graphScore: 15,
          vectorScore: 0.9
        }
      }
    ];

    const compatible =
      filterCompatibleEvidence(
        "What is PEP-484?",
        evidence
      );

    const confidence =
      computeGroundedAnswerConfidence({
        evidence: compatible
      });

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
    expect(confidence).not.toBe(15.9);
  });

});
