import type { ParsedDocument } from "@knowledge/shared";
import type { KnowledgeEntity } from "../models/entity.js";

export class AuthorRule {

  extract(document: ParsedDocument): KnowledgeEntity {

    return {

      id: document.metadata.author
        .toLowerCase()
        .replace(/\s+/g, "-"),

      type: "Author",

      properties: {

        name: document.metadata.author

      }

    };

  }

}