import { describe, expect, it } from "vitest";
import {
  collectGroundedEvidence,
  deriveGraphFromResult,
  deriveRelationshipPath,
  deriveRelationshipView
} from "./graph-from-result";
import {
  classifyGroundingState,
  formatConfidencePercent,
  resolveProvenanceChannel
} from "./provenance";
import type { ReasoningResult } from "../types/reasoning";

const sample: ReasoningResult = {
  answer: "Type Hints introduced Typing.",
  confidence: 0.64,
  citations: [],
  trace: {
    steps: [
      {
        description:
          "Selected Proposal: Type Hints via INTRODUCES (proposal:PEP-484 → feature:typing)",
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
        description:
          "Selected Proposal: Type Hints via ADDRESSES (proposal:PEP-484 → concern:readability)",
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
            score: 0.85,
            source: "graph",
            relationship: {
              from: "proposal:PEP-484",
              to: "concern:readability",
              type: "ADDRESSES",
              confidence: 1
            }
          }
        ]
      },
      {
        description:
          "Selected Proposal: Type Hints via PROPOSED_BY (proposal:PEP-484 → author:guido-van-rossum)",
        evidence: [
          {
            entity: {
              id: "author:guido-van-rossum",
              type: "Author",
              label: "Guido van Rossum",
              source: "pep-484.md",
              confidence: 1,
              properties: {}
            },
            score: 0.8,
            source: "graph",
            relationship: {
              from: "proposal:PEP-484",
              to: "author:guido-van-rossum",
              type: "PROPOSED_BY",
              confidence: 1
            }
          }
        ]
      }
    ]
  }
};

const chainSample: ReasoningResult = {
  answer: "Typing addressed Readability.",
  confidence: 0.7,
  citations: [],
  trace: {
    steps: [
      {
        description: "hop1",
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
            score: 0.9,
            source: "graph",
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
        description: "hop2",
        evidence: [
          {
            entity: {
              id: "concern:readability",
              type: "Concern",
              label: "Readability",
              source: "pep-484.md",
              confidence: 1,
              properties: {}
            },
            score: 0.8,
            source: "graph",
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

  it("treats hub spokes as a relationship set, not a fake path", () => {
    const view = deriveRelationshipView(sample);
    expect(view.kind).toBe("set");
    expect(view.hubId).toBe("proposal:PEP-484");
    expect(view.hops.map((hop) => hop.relationshipType).sort()).toEqual([
      "ADDRESSES",
      "INTRODUCES",
      "PROPOSED_BY"
    ]);

    const graph = deriveGraphFromResult(sample);
    expect(graph.hasRelationshipData).toBe(true);
    expect(graph.edges).toHaveLength(3);

    const evidence = collectGroundedEvidence(sample);
    expect(evidence.map((item) => item.entity.id).sort()).toEqual([
      "author:guido-van-rossum",
      "proposal:PEP-484"
    ]);
  });

  it("keeps true multi-hop chains as a path", () => {
    const view = deriveRelationshipView(chainSample);
    expect(view.kind).toBe("path");
    expect(view.hops.map((hop) => hop.relationshipType)).toEqual([
      "INTRODUCES",
      "ADDRESSES"
    ]);
    expect(deriveRelationshipPath(chainSample)).toHaveLength(2);
  });
});
