import { describe, expect, it } from "vitest";
import {
  collectGroundedEvidence,
  deriveGraphFromResult,
  deriveRelationshipPath
} from "./graph-from-result";
import {
  classifyGroundingState,
  formatConfidencePercent,
  resolveProvenanceChannel
} from "./provenance";
import type { ReasoningResult } from "../types/reasoning";

const sample: ReasoningResult = {
  answer: "Proposal: Type Hints",
  confidence: 0.64,
  citations: [],
  trace: {
    steps: [
      {
        description: "Selected Proposal: Type Hints via INTRODUCES (a → b)",
        evidence: [
          {
            entity: {
              id: "proposal:PEP-484",
              type: "Proposal",
              label: "Type Hints",
              source: "pep-484.md",
              confidence: 1,
              properties: {}
            },
            score: 0.9,
            source: "graph",
            metadata: { sources: ["graph", "vector"] },
            relationship: {
              from: "proposal:PEP-484",
              to: "feature:typing",
              type: "INTRODUCES",
              confidence: 1
            }
          }
        ]
      },
      {
        description: "Selected Feature: Typing",
        evidence: [
          {
            entity: {
              id: "feature:typing",
              type: "Feature",
              label: "Typing",
              source: "pep-484.md",
              confidence: 1,
              properties: {}
            },
            score: 0.8,
            source: "vector",
            relationship: {
              from: "feature:typing",
              to: "concern:readability",
              type: "ADDRESSES",
              confidence: 1
            }
          }
        ]
      }
    ]
  }
};

describe("frontend result helpers", () => {
  it("resolves hybrid provenance from metadata.sources", () => {
    expect(
      resolveProvenanceChannel({
        source: "graph",
        metadata: { sources: ["graph", "vector"] }
      })
    ).toBe("hybrid");
  });

  it("formats public confidence as a percent", () => {
    expect(formatConfidencePercent(0.64)).toBe("64%");
    expect(formatConfidencePercent(1.5)).toBe("100%");
  });

  it("classifies fail-closed results", () => {
    expect(
      classifyGroundingState({
        answer: "",
        confidence: 0,
        citations: [],
        trace: { steps: [] }
      })
    ).toBe("fail_closed");
  });

  it("derives relationship paths without inventing edges", () => {
    const path = deriveRelationshipPath(sample);
    expect(path.map((hop) => hop.relationshipType)).toEqual([
      "INTRODUCES",
      "ADDRESSES"
    ]);

    const graph = deriveGraphFromResult(sample);
    expect(graph.hasRelationshipData).toBe(true);
    expect(graph.edges).toHaveLength(2);

    const evidence = collectGroundedEvidence(sample);
    expect(evidence.map((item) => item.entity.id).sort()).toEqual([
      "feature:typing",
      "proposal:PEP-484"
    ]);
  });
});
