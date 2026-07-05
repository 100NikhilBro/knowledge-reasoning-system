import type {
  EvidenceSet
} from "@knowledge/shared";

export interface ConfidenceEngine {

  calculate(
    evidence: EvidenceSet
  ): Promise<number>;

}