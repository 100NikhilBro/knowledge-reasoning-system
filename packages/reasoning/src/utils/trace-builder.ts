import type {
  EvidenceSet,
  ReasoningTrace,
  ReasoningStep
} from "@knowledge/shared";

export function buildTrace(

  evidenceSet: EvidenceSet

): ReasoningTrace {

  const steps: ReasoningStep[] =

    evidenceSet.evidence.map(item => ({

      description:

        `Selected ${item.entity.type}: ${item.entity.label}`,

      evidence: [

        item

      ]

    }));

  return {

    steps

  };

}