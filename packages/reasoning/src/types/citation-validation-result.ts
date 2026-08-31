import type {
  Citation
} from "@knowledge/shared";

export interface CitationValidationResult {

  valid: Citation[];

  rejected: Citation[];

}
