import type {
  EvidenceSet
} from "@knowledge/shared";

export interface EvidenceSynthesizer {

  synthesize(
    evidence: EvidenceSet
  ): Promise<EvidenceSet>;

}