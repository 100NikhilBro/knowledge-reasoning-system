import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  Evidence,
  EvidenceSet,
  GraphNeighbor
} from "@knowledge/shared";

import type {
  GraphReasoner
} from "../contracts/graph-reasoner.js";


import type {
  ReasoningPlan
} from "@knowledge/shared";

import {

  ReasoningStrategyFactory

} from "../strategy/reasoning-strategy-factory.js";

export class DefaultGraphReasoner
implements GraphReasoner {

  constructor(

    private readonly graph =
      new GraphTraversalService()

  ) {}

  async reason(

  plan: ReasoningPlan,

  evidence: EvidenceSet

): Promise<EvidenceSet> {

  const strategy =

    ReasoningStrategyFactory.create(

      plan

    );

  return strategy.execute(

    this.graph,

    plan,

    evidence

  );

}

  private toEvidence(

    neighbor: GraphNeighbor

  ): Evidence {

    return {

      entity: neighbor.neighbor,

      score: 0.75,

      source: "graph"

    };

  }

  private removeDuplicates(

    evidence: Evidence[]

  ): Evidence[] {

    const unique =

      new Map<string, Evidence>();

    for (const item of evidence) {

      unique.set(

        item.entity.id,

        item

      );

    }

    return [

      ...unique.values()

    ];

  }

}