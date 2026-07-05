import type {
  Evidence
} from "@knowledge/shared";

export interface VerificationResult {

  valid: Evidence[];

  rejected: Evidence[];

}