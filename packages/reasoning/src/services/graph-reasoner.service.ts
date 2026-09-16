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

      source: "graph",

      relationship: neighbor.relationship

    };

  }

  private removeDuplicates(

    evidence: Evidence[]

  ): Evidence[] {

    const unique =

      new Map<string, Evidence>();

    for (const item of evidence) {

      const key =
        item.relationship
          ? `${item.entity.id}|${item.relationship.from}|${item.relationship.type}|${item.relationship.to}`
          : item.entity.id;

      const existing =
        unique.get(key);

      if (
        !existing ||
        item.score > existing.score
      ) {
        unique.set(key, item);
      }

    }

    return [

      ...unique.values()

    ];

  }

}