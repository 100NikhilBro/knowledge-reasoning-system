import {
  describe,
  expect,
  it
} from "vitest";

import {
  DefaultConfidenceEngine
} from "../src/services/confidence-engine.service.js";

describe("Confidence Engine", () => {

  const engine =
    new DefaultConfidenceEngine();

  it("should return 0 for empty evidence", async () => {
    const confidence =
      await engine.calculate({
        evidence: []
      });

    expect(confidence).toBe(0);
  });

  it("should return unit confidence for strong single evidence", async () => {
    const confidence =
      await engine.calculate({
        evidence: [
          {
            entity: {
              id: "1",
              type: "Proposal",
              label: "PEP-484",
              source: "pep",
              confidence: 1,
              properties: {}
            },
            score: 0.9,
            source: "graph"
          }
        ]
      });

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it("should keep multi-evidence confidence in [0,1]", async () => {
    const confidence =
      await engine.calculate({
        evidence: [
          {
            entity: {
              id: "1",
              type: "Proposal",
              label: "A",
              source: "doc",
              confidence: 1,
              properties: {}
            },
            score: 0.8,
            source: "graph"
          },
          {
            entity: {
              id: "2",
              type: "Proposal",
              label: "B",
              source: "doc",
              confidence: 1,
              properties: {}
            },
            score: 0.6,
            source: "graph"
          }
        ]
      });

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it("must not return raw graph score magnitudes as confidence", async () => {
    const confidence =
      await engine.calculate({
        evidence: [
          {
            entity: {
              id: "proposal:PEP-484",
              type: "Proposal",
              label: "Type Hints",
              source: "pep",
              confidence: 1,
              properties: {}
            },
            score: 6.25,
            source: "graph"
          }
        ]
      });

    expect(confidence).toBeLessThanOrEqual(1);
    expect(confidence).not.toBe(6.25);
  });

});
