import type {
  Evidence,
  EvidenceSet
} from "@knowledge/shared";

import type {
  ContextBuilder
} from "../contracts/context-builder.js";

import type {
  GroundedEvidenceItem,
  ReasoningContext
} from "../types/reasoning-context.js";

import type {
  ReasoningContextConfig
} from "../types/reasoning-context-config.js";

import {
  resolveReasoningContextConfig
} from "../config/resolve-reasoning-context-config.js";

import {
  applyEvidenceBudget
} from "../utils/apply-evidence-budget.js";

function toGroundedItem(
  evidence: Evidence
): GroundedEvidenceItem {

  const item: GroundedEvidenceItem = {

    entityId:
      evidence.entity.id,

    entityType:
      evidence.entity.type,

    label:
      evidence.entity.label,

    source:
      evidence.entity.source,

    confidence:
      evidence.entity.confidence,

    score:
      evidence.score,

    evidenceSource:
      evidence.source

  };

  if (
    evidence.entity.properties &&
    Object.keys(evidence.entity.properties).length > 0
  ) {

    item.properties =
      evidence.entity.properties;

  }

  if (evidence.relationship !== undefined) {

    item.relationship =
      evidence.relationship;

  }

  return item;

}

export class DefaultContextBuilder
implements ContextBuilder {

  constructor(

    private readonly defaultConfig:
      ReasoningContextConfig =
        resolveReasoningContextConfig()

  ) {}

  build(

    evidenceSet: EvidenceSet,

    config: ReasoningContextConfig =
      this.defaultConfig

  ): ReasoningContext {

    const input =
      evidenceSet.evidence;

    const retained =
      applyEvidenceBudget(
        input,
        {
          maxEvidence:
            config.maxEvidence
        }
      );

    const context: ReasoningContext = {

      items:
        retained.map(toGroundedItem),

      evidence:
        retained,

      budget: {

        maxEvidence:
          config.maxEvidence,

        inputCount:
          input.length,

        retainedCount:
          retained.length,

        truncated:
          retained.length < input.length

      },

      config

    };

    if (evidenceSet.comparison !== undefined) {

      context.comparison =
        evidenceSet.comparison;

    }

    return context;

  }

}
