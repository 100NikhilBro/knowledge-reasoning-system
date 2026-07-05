import type {
  Citation,
  EvidenceSet
} from "@knowledge/shared";

export interface CitationBuilder {

  build(
    evidence: EvidenceSet
  ): Promise<Citation[]>;

}