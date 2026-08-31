import type {
  VerificationRules
} from "../types/verification-rules.js";

export const DEFAULT_VERIFICATION_RULES: VerificationRules = {

  minimumScore: 0,

  minimumConfidence: 0.5,

  requireSource: true,

  /**
   * Canonical knowledge-model types must be allowlisted so relationship
   * targets (Author via PROPOSED_BY, Decision via RESULTS_IN, etc.) survive
   * synthesis. "Person" remains for legacy fixtures.
   */
  allowedEntityTypes: [

    "Proposal",

    "Author",

    "Person",

    "Organization",

    "Concept",

    "Feature",

    "Concern",

    "Decision",

    "PythonVersion"

  ]

};
