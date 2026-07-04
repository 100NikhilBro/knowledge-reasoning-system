import { describe, expect, it } from "vitest";

import { EntityExtractor } from "../src/extractors/entity.extractor.js";

const sampleDocument = {
  metadata: {
    pep: "484",
    title: "Type Hints",
    author: "Guido van Rossum",
    status: "Accepted",
    type: "Standards Track",
    created: "29-Sep-2014"
  },
  sections: [],
  raw: "",
  warnings: []
};

describe("EntityExtractor", () => {

  it("should extract proposal entity", () => {

    const extractor = new EntityExtractor();

    const entities = extractor.extract(sampleDocument);

    const proposal = entities.find(
      entity => entity.type === "Proposal"
    );

    expect(proposal).toBeDefined();

    expect(proposal?.id).toBe("proposal:PEP-484");

    expect(proposal?.label).toBe("Type Hints");

  });

  it("should extract author entity", () => {

    const extractor = new EntityExtractor();

    const entities = extractor.extract(sampleDocument);

    const author = entities.find(
      entity => entity.type === "Author"
    );

    expect(author).toBeDefined();

    expect(author?.id).toBe("author:guido-van-rossum");

    expect(author?.label).toBe("Guido van Rossum");

  });

  it("should return two entities", () => {

    const extractor = new EntityExtractor();

    const entities = extractor.extract(sampleDocument);

    expect(entities.length).toBe(2);

  });

  it("should extract feature entity", () => {

  const extractor = new EntityExtractor();

  const document = {
    ...sampleDocument,
    sections: [
      {
        title: "Abstract",
        level: 1,
        content: "This PEP introduces type hints."
      }
    ]
  };

  const entities = extractor.extract(document);

  const feature = entities.find(
    entity => entity.type === "Feature"
  );

  expect(feature).toBeDefined();

  expect(feature?.label).toBe("Typing");

});

it("should extract concern entity", () => {

  const extractor = new EntityExtractor();

  const document = {
    ...sampleDocument,
    sections: [
      {
        title: "Rationale",
        level: 1,
        content: "Type hints improve readability."
      }
    ]
  };

  const entities = extractor.extract(document);

  const concern = entities.find(
    entity => entity.type === "Concern"
  );

  expect(concern).toBeDefined();

  expect(concern?.label).toBe("Readability");

});

});