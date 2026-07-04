// import type { ParsedDocument } from "@knowledge/parser";
// import type { ExtractionRule } from "../contracts/extraction-rule.js";
// import type { KnowledgeEntity } from "../models/entity.js";

// export class ConcernRule implements ExtractionRule {

//     readonly name = "ConcernRule";

//   extract(document: ParsedDocument): KnowledgeEntity | null {

//     const content = document.sections
//       .map(section => section.content.toLowerCase())
//       .join(" ");

//     if (content.includes("readability")) {

//       return {

//         id: "concern:readability",

//         type: "Concern",

//         label: "Readability",

//         source: "pep-484.md",

//         confidence: 0.9,

//         properties: {

//           name: "Readability"

//         }

//       };

//     }

//     return null;

//   }

// }



import type { ParsedDocument } from "@knowledge/parser";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
import type { KnowledgeEntity } from "../models/entity.js";

import { buildGraphId } from "@knowledge/shared";

export class ConcernRule implements ExtractionRule {

  readonly name = "ConcernRule";

  extract(document: ParsedDocument): KnowledgeEntity | null {

    const content = document.sections
      .map(section => section.content.toLowerCase())
      .join(" ");

    if (content.includes("readability")) {

      const slug = "readability";

      return {

        id: buildGraphId(
          "Concern",
          slug
        ),

        type: "Concern",

        label: "Readability",

        source: "pep-484.md",

        confidence: 0.9,

        properties: {

          name: "Readability"

        }

      };

    }

    return null;

  }

}