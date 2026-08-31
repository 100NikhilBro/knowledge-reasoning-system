import type {
  Citation
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import type {
  CitationValidationResult
} from "../types/citation-validation-result.js";

export interface CitationValidator {

  validate(
    citations: Citation[],
    context: ReasoningContext
  ): CitationValidationResult;

}
