import type {
  VerificationRules
} from "../types/verification-rules.js";

export const DEFAULT_VERIFICATION_RULES: VerificationRules = {

  minimumScore: 0,

  minimumConfidence: 0.5,

  requireSource: true,

  allowedEntityTypes: [

    "Proposal",

    "Person",

    "Organization",

    "Concept"

  ]

};