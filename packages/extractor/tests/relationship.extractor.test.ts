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

  it("should return empty relationships when proposal is missing", () => {

    const relationships = extractor.extract(
      entities.filter(e => e.type !== "Proposal")
    );

    expect(relationships.length).toBe(0);

  });

});