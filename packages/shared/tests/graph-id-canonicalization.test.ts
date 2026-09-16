import { describe, expect, it } from "vitest";

import {
  buildGraphId,
  canonicalizeEntityKey,
  canonicalizeRelationshipType,
  isAllowedRelationshipType
} from "@knowledge/shared";

describe("graph id canonicalization", () => {

  it("maps PEP formatting variants to one Proposal key", () => {

    const variants = [
      "PEP-484",
      "PEP 484",
      "pep484",
      "pep-484",
      "484"
    ];

    const keys = variants.map(value =>
      canonicalizeEntityKey("Proposal", value)
    );

    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("PEP-484");

    const ids = variants.map(value =>
      buildGraphId("Proposal", value)
    );

    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe("proposal:PEP-484");

  });

  it("maps Feature name casing/format variants to one id", () => {

    expect(buildGraphId("Feature", "Typing"))
      .toBe("feature:typing");

    expect(buildGraphId("Feature", "typing"))
      .toBe("feature:typing");

    expect(buildGraphId("Feature", "feature:typing"))
      .toBe("feature:typing");

  });

  it("keeps genuinely distinct entities distinct", () => {

    expect(buildGraphId("Proposal", "PEP-484"))
      .not.toBe(buildGraphId("Proposal", "PEP-8"));

    expect(buildGraphId("Feature", "Typing"))
      .not.toBe(buildGraphId("Feature", "Asyncio"));

    expect(buildGraphId("Author", "Guido van Rossum"))
      .not.toBe(buildGraphId("Author", "Łukasz Langa"));

  });

  it("canonicalizes relationship type spelling", () => {

    expect(canonicalizeRelationshipType("proposed_by"))
      .toBe("PROPOSED_BY");

    expect(canonicalizeRelationshipType("PROPOSED-BY"))
      .toBe("PROPOSED_BY");

    expect(canonicalizeRelationshipType("  introduces "))
      .toBe("INTRODUCES");

    expect(isAllowedRelationshipType("RELATED_TO"))
      .toBe(false);

    expect(isAllowedRelationshipType("proposed_by"))
      .toBe(true);

  });

});
