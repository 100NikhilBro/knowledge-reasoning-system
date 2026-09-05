import type {
  EvidenceSet,
  ReasoningTrace,
  ReasoningStep
} from "@knowledge/shared";

export function buildTrace(

  evidenceSet: EvidenceSet

): ReasoningTrace {

  const steps: ReasoningStep[] =

    evidenceSet.evidence.map(item => {

      const base =
        `Selected ${item.entity.type}: ${item.entity.label}`;

      const description =
        item.relationship
          ? `${base} via ${item.relationship.type} (${item.relationship.from} → ${item.relationship.to})`
          : base;

      return {

        description,

        evidence: [
          item
        ]

      };

    });

  return {

    steps

  };

}
