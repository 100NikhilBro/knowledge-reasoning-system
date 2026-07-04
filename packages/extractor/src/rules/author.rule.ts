import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";

export class AuthorRule implements ExtractionRule{

    readonly name = "AuthorRule";

  extract(document: ParsedDocument): KnowledgeEntity {

    return {

  id: `author:${document.metadata.author
    .toLowerCase()
    .replace(/\s+/g, "-")}`,

  type: "Author",

  label: document.metadata.author,

  source: "pep-484.md",

  confidence: 1.0,

  properties: {

    name: document.metadata.author

  }

};

  }

}