import type {
  EvidenceSet,
  ReasoningResult
} from "@knowledge/shared";

export interface AnswerGenerator {

  generate(
    evidence: EvidenceSet
  ): Promise<ReasoningResult>;

}