import { describe, expect, it } from "vitest";

import { EntityExtractor } from "../src/extractors/entity.extractor.js";
import { buildGraphId } from "@knowledge/shared";

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

  it("should extract decision from status metadata", () => {

    const extractor = new EntityExtractor();

    const entities = extractor.extract(sampleDocument);

    const decision = entities.find(
      entity => entity.type === "Decision"
    );

    expect(decision).toBeDefined();
    expect(decision?.id).toBe("decision:accepted");
    expect(decision?.label).toBe("Accepted");
    expect(decision?.properties.outcome).toBe("Accepted");
    expect(decision?.source).toBe("pep-484.md");

  });

  it("should keep baseline PEP-484 entities without sections", () => {

    const extractor = new EntityExtractor();

    const entities = extractor.extract(sampleDocument);

    const types = entities.map(entity => entity.type).sort();

    expect(types).toEqual([
      "Author",
      "Decision",
      "Proposal"
    ]);

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

  it("should extract python version when metadata provides evidence", () => {

    const extractor = new EntityExtractor();

    const document = {
      ...sampleDocument,
      metadata: {
        ...sampleDocument.metadata,
        python_version: "3.5"
      }
    };

    const entities = extractor.extract(document);

    const version = entities.find(
      entity => entity.type === "PythonVersion"
    );

    expect(version).toBeDefined();
    expect(version?.id).toBe(
      buildGraphId("PythonVersion", "3.5")
    );
    expect(version?.label).toBe("3.5");
    expect(version?.properties.version).toBe("3.5");

  });

  it("should not fabricate decision or python version without evidence", () => {

    const extractor = new EntityExtractor();

    const document = {
      metadata: {
        pep: "999",
        title: "No Status PEP",
        author: "Someone"
      },
      sections: [],
      raw: "",
      warnings: []
    };

    const entities = extractor.extract(document);

    expect(
      entities.some(entity => entity.type === "Decision")
    ).toBe(false);

    expect(
      entities.some(entity => entity.type === "PythonVersion")
    ).toBe(false);

    expect(
      entities.some(entity => entity.type === "Feature")
    ).toBe(false);

    expect(
      entities.some(entity => entity.type === "Concern")
    ).toBe(false);

  });

  it("should reject python version metadata without digits", () => {

    const extractor = new EntityExtractor();

    const document = {
      ...sampleDocument,
      metadata: {
        ...sampleDocument.metadata,
        python_version: "unknown"
      }
    };

    const entities = extractor.extract(document);

    expect(
      entities.some(entity => entity.type === "PythonVersion")
    ).toBe(false);

  });

  it("should keep graph ids deterministic", () => {

    const extractor = new EntityExtractor();

    const first = extractor.extract(sampleDocument);
    const second = extractor.extract(sampleDocument);

    expect(first.map(entity => entity.id))
      .toEqual(second.map(entity => entity.id));

  });

});
