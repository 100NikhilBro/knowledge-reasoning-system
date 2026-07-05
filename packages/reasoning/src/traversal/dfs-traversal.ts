import type {
  EvidenceSet,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  propagateConfidence
} from "../utils/propagate-confidence.js";

import { buildPropagatedConfidence } from "../utils/build-propagated-confidence.js";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  GraphTraversal
} from "../contracts/graph-traversal.js";

import {
  TraversalGuard
} from "../utils/traversal-guard.js";

import {
  TraversalLimiter
} from "../utils/traversal-limiter.js";

export class DFSTraversal
implements GraphTraversal {

  async traverse(

    graph: GraphTraversalService,

    evidence: EvidenceSet,

    maxDepth: number

  ): Promise<KnowledgeEntity[]> {

    const result: KnowledgeEntity[] = [];

    const visited =

      new TraversalGuard();

    const limiter =

      new TraversalLimiter({

        maxDepth,

        maxNodes: 100

      });

    for (

      const item of evidence.evidence

    ) {

      await this.visit(

        graph,

        item.entity,

        result,

        visited,

        limiter,

        0

      );

    }

    return result;

  }

  private async visit(

    graph: GraphTraversalService,

    node: KnowledgeEntity,

    result: KnowledgeEntity[],

    visited: TraversalGuard,

    limiter: TraversalLimiter,

    depth: number

  ): Promise<void> {

    if (

      !limiter.canContinue(

        depth,

        visited.size()

      ) ||

      visited.has(

        node.id

      )

    ) {

      return;

    }

    visited.add(

      node.id

    );

    result.push({

  ...node,

  ...buildPropagatedConfidence(

  depth

)

});

    const neighbors =

      await graph.findNeighbors(

        node.type,

        node.id

      );

    for (

      const neighbor of neighbors

    ) {

      await this.visit(

        graph,

        neighbor.neighbor,

        result,

        visited,

        limiter,

        depth + 1

      );

    }

  }

}