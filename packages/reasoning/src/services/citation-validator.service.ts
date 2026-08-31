import type {
  Citation
} from "@knowledge/shared";

import type {
  CitationValidator
} from "../contracts/citation-validator.js";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import type {
  CitationValidationResult
} from "../types/citation-validation-result.js";

function citationKey(
  citation: Citation
): string {

  return `${citation.entityId}\0${citation.source}`;

}

/**
 * Validates citations against the verified reasoning context.
 * Rejects invalid citations; never fabricates replacements.
 * Deduplicates deterministically (first occurrence wins).
 */
export class DefaultCitationValidator
implements CitationValidator {

  validate(

    citations: Citation[],

    context: ReasoningContext

  ): CitationValidationResult {

    const allowed =
      new Map<string, string>();

    for (const item of context.items) {

      allowed.set(
        item.entityId,
        item.source
      );

    }

    const valid: Citation[] = [];

    const rejected: Citation[] = [];

    const seen =
      new Set<string>();

    for (const citation of citations) {

      const entityId =
        citation.entityId?.trim() ?? "";

      const source =
        citation.source?.trim() ?? "";

      if (entityId.length === 0 || source.length === 0) {

        rejected.push(citation);

        continue;

      }

      const expectedSource =
        allowed.get(entityId);

      if (
        expectedSource === undefined ||
        expectedSource !== source
      ) {

        rejected.push(citation);

        continue;

      }

      const key =
        citationKey({
          entityId,
          source
        });

      if (seen.has(key)) {

        // Duplicate — drop deterministically; not a rejection reason noise.
        continue;

      }

      seen.add(key);

      valid.push({
        entityId,
        source
      });

    }

    return {
      valid,
      rejected
    };

  }

}
