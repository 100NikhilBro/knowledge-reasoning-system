export interface VerificationRules {

  minimumScore: number;

  minimumConfidence: number;

  requireSource: boolean;

  allowedEntityTypes: string[];

}