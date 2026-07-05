
import type {
  EvidenceSet,
  ReasoningPlan
} from "@knowledge/shared";

export interface GraphReasoner {

  reason(

    plan: ReasoningPlan,

    evidence: EvidenceSet

): Promise<EvidenceSet>;
}