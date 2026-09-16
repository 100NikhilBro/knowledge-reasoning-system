import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";

import { buildGraphId } from "@knowledge/shared";

import { resolveDocumentSource } from "../utils/resolve-document-source.js";

export class AuthorRule implements ExtractionRule {

  readonly name = "AuthorRule";

  extract(document: ParsedDocument): KnowledgeEntity {

    return {

      id: buildGraphId(
        "Author",
        document.metadata.author
      ),

      type: "Author",

      label: document.metadata.author,

      source: resolveDocumentSource(document),

      confidence: 1.0,

      properties: {

        name: document.metadata.author

      }

    };

  }

}
