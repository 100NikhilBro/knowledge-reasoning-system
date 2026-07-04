import { describe, expect, it } from "vitest";

import { PEPParser } from "../src/parsers/pep.parser.js";

describe("PEP Parser", () => {

  it("should parse metadata", () => {

    const parser = new PEPParser();

    const result = parser.parse(`
PEP: 484

Title: Type Hints

Author: Guido

Status: Accepted
`);

    expect(result.document.metadata.pep).toBe("484");

    expect(result.document.metadata.title).toBe("Type Hints");

    expect(result.document.metadata.author).toBe("Guido");

  });


  it("should parse sections", () => {

  const parser = new PEPParser();

  const result = parser.parse(`
PEP: 484

Title: Type Hints

Author: Guido

Abstract
========

Hello World

Motivation
==========

Need typing
`);

  expect(result.document.sections.length).toBe(2);

  expect(result.document.sections[0].title).toBe("Abstract");

  expect(result.document.sections[0].content).toBe("Hello World");

  expect(result.document.sections[1].title).toBe("Motivation");

});

});