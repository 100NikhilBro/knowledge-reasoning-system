import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveApiConfig } from "../api/client";
import {
  collectGroundedEvidence,
  deriveGraphFromResult
} from "../lib/graph-from-result";
import type { ReasoningResult } from "../types/reasoning";

const sample: ReasoningResult = {
  answer: "Proposal: Type Hints",
  confidence: 1,
  citations: [
    {
      entityId: "proposal:PEP-484",
      source: "pep-484.md"
    }
  ],
  trace: {
    steps: [
      {
        description: "Selected Proposal: Type Hints",
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
            relationship: {
              from: "proposal:PEP-484",
              to: "feature:typing",
              type: "INTRODUCES",
              confidence: 0.8
            }
          }
        ]
      }
    ]
  }
};

describe("api client config", () => {
  it("reads API settings from env without hardcoded secrets", () => {
    const config = resolveApiConfig({
      VITE_API_BASE_URL: "http://localhost:3000",
      VITE_API_KEY: "from-env-only"
    } as ImportMetaEnv);

    expect(config.baseUrl).toBe("http://localhost:3000");
    expect(config.apiKey).toBe("from-env-only");
  });

  it("keeps source free of embedded production credentials", () => {
    const clientPath = resolve(
      process.cwd(),
      "src/api/client.ts"
    );
    const source = readFileSync(clientPath, "utf8");

    expect(source).not.toMatch(/change-me-in-development/);
    expect(source).not.toMatch(/password123/);
    expect(source).not.toMatch(/sk-[a-zA-Z0-9]+/);
  });
});

describe("graph derivation", () => {
  it("builds nodes and only real relationships from the response", () => {
    const graph = deriveGraphFromResult(sample);

    expect(graph.nodes.some((node) => node.id === "proposal:PEP-484")).toBe(
      true
    );
    expect(graph.hasRelationshipData).toBe(true);
    expect(graph.edges[0]?.type).toBe("INTRODUCES");
  });

  it("collects grounded evidence without inventing scores", () => {
    const evidence = collectGroundedEvidence(sample);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.score).toBe(0.9);
  });
});
