import type { ParsedDocument } from "@knowledge/shared";

export class ParserValidator {

  validate(document: ParsedDocument) {

    const required = ["pep", "title", "author"];

    for (const field of required) {

      if (!document.metadata[field]) {

        document.warnings.push({
          code: `MISSING_${field.toUpperCase()}`,
          message: `${field} is missing`
        });

      }

    }

  }

}