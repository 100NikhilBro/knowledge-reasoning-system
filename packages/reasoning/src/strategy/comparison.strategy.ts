import type {
  EvidenceSet,
  ReasoningPlan
} from "@knowledge/shared";

import {

  renderComparison

} from "../utils/render-comparison.js";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  ReasoningStrategy
} from "./reasoning-strategy.js";

import {
  compareEvidence
} from "../utils/compare-evidence.js";

import {
  buildComparisonSummary
} from "../utils/build-comparison-summary.js";

export class ComparisonStrategy
implements ReasoningStrategy {

  async execute(

    _graph: GraphTraversalService,

    _plan: ReasoningPlan,

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    if (

      evidence.evidence.length < 2

    ) {

      return evidence;

    }

    const left = {

      evidence: [

        evidence.evidence[0]

      ]

    };

    const right = {

      evidence:

        evidence.evidence.slice(1)

    };

    const result =

      compareEvidence(

        left,

        right

      );

  const summary =

  buildComparisonSummary(

    result

  );

const answer =

  renderComparison(

    summary

  );

return {

  evidence: [

    ...result.common,

    ...result.onlyLeft,

    ...result.onlyRight

  ],

  comparison: answer

};


  }

}