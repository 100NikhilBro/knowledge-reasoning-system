import type {
  EvidenceSet,
  ReasoningRequest
} from "@knowledge/shared";

export interface EvidenceCollector {

  collect(
    request: ReasoningRequest
  ): Promise<EvidenceSet>;

}