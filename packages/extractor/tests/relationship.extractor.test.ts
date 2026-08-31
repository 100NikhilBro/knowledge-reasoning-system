import { describe, expect, it } from "vitest";

import { RelationshipExtractor } from "../src/extractors/relationship.extractor.js";

describe("RelationshipExtractor", () => {

  const extractor = new RelationshipExtractor();

  const entities = [

    {
      id: "proposal:PEP-484",
      type: "Proposal",
      label: "Type Hints",
      source: "pep.md",
      confidence: 1,
      properties: {}
    },

    {
      id: "author:guido",
      type: "Author",
      label: "Guido",
      source: "pep.md",
      confidence: 1,
      properties: {}
    },

    {
      id: "feature:typing",
      type: "Feature",
      label: "Typing",
      source: "pep.md",
      confidence: 1,
      properties: {}
    },

    {
      id: "concern:readability",
      type: "Concern",
      label: "Readability",
      source: "pep.md",
      confidence: 1,
      properties: {}
    },

    {
      id: "decision:accepted",
      type: "Decision",
      label: "Accepted",
      source: "pep.md",
      confidence: 1,
      properties: { outcome: "Accepted" }
    },

    {
      id: "pythonversion:3.5",
      type: "PythonVersion",
      label: "3.5",
      source: "pep.md",
      confidence: 1,
      properties: { version: "3.5" }
    }

  ];

  it("should create PROPOSED_BY relationship", () => {

    const relationships = extractor.extract(entities);

    expect(
      relationships.some(r => r.type === "PROPOSED_BY")
    ).toBe(true);

  });

  it("should create INTRODUCES relationship", () => {

    const relationships = extractor.extract(entities);

    expect(
      relationships.some(r => r.type === "INTRODUCES")
    ).toBe(true);

  });

  it("should create ADDRESSES relationship", () => {

    const relationships = extractor.extract(entities);

    expect(
      relationships.some(r => r.type === "ADDRESSES")
    ).toBe(true);

  });

  it("should create RESULTS_IN relationship", () => {

    const relationships = extractor.extract(entities);

    const resultsIn = relationships.find(
      relationship => relationship.type === "RESULTS_IN"
    );

    expect(resultsIn).toBeDefined();
    expect(resultsIn?.from).toBe("proposal:PEP-484");
    expect(resultsIn?.to).toBe("decision:accepted");

  });

  it("should create IMPLEMENTED_IN relationship", () => {

    const relationships = extractor.extract(entities);

    const implementedIn = relationships.find(
      relationship => relationship.type === "IMPLEMENTED_IN"
    );

    expect(implementedIn).toBeDefined();
    expect(implementedIn?.from).toBe("decision:accepted");
    expect(implementedIn?.to).toBe("pythonversion:3.5");

  });

  it("should return empty relationships when proposal is missing", () => {

    const relationships = extractor.extract(
      entities.filter(e => e.type !== "Proposal")
    );

    // PROPOSED_BY / INTRODUCES / ADDRESSES / RESULTS_IN require Proposal.
    // IMPLEMENTED_IN only needs Decision + PythonVersion.
    expect(
      relationships.every(
        relationship =>
          relationship.type === "IMPLEMENTED_IN"
      )
    ).toBe(true);

    expect(relationships).toHaveLength(1);

  });

  it("should not fabricate RESULTS_IN or IMPLEMENTED_IN without entities", () => {

    const relationships = extractor.extract([
      {
        id: "proposal:PEP-1",
        type: "Proposal",
        label: "One",
        source: "pep.md",
        confidence: 1,
        properties: {}
      }
    ]);

    expect(
      relationships.some(r => r.type === "RESULTS_IN")
    ).toBe(false);

    expect(
      relationships.some(r => r.type === "IMPLEMENTED_IN")
    ).toBe(false);

    expect(
      relationships.some(r => r.type === "RELATED_TO")
    ).toBe(false);

    expect(
      relationships.some(r => r.type === "SUPERSEDES")
    ).toBe(false);

  });

});
