import type {
  EvidenceSet,
  KnowledgeEntity
} from "@knowledge/shared";

import {

  buildPropagatedConfidence

} from "../utils/build-propagated-confidence.js";

import {
  propagateConfidence
} from "../utils/propagate-confidence.js";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  GraphTraversal
} from "../contracts/graph-traversal.js";

import type {
  TraversalState
} from "../types/traversal-state.js";

import {
  TraversalGuard
} from "../utils/traversal-guard.js";

import {
  TraversalLimiter
} from "../utils/traversal-limiter.js";

export class BFSTraversal
implements GraphTraversal {

  async traverse(

    graph: GraphTraversalService,

    evidence: EvidenceSet,

    maxDepth: number

  ): Promise<KnowledgeEntity[]> {

    const limiter =

      new TraversalLimiter({

        maxDepth,

        maxNodes: 100

      });

    const state: TraversalState = {

      queue:

        evidence.evidence.map(

          item => item.entity

        ),

      visited:

        new TraversalGuard(),

      result: [],

      depth: 0

    };

    while (

      state.queue.length > 0 &&

      limiter.canContinue(

        state.depth,

        state.visited.size()

      )

    ) {

      const levelSize =

        state.queue.length;

      for (

        let i = 0;

        i < levelSize;

        i++

      ) {

        const current =

          state.queue.shift()!;

        if (

          state.visited.has(

            current.id

          )

        ) {

          continue;

        }

        state.visited.add(

          current.id

        );

        state.result.push({

  ...current,

  ...buildPropagatedConfidence(

  state.depth

)

});

        const neighbors =

          await graph.findNeighbors(

            current.type,

            current.id

          );

        for (

          const neighbor of neighbors

        ) {

          if (

            !state.visited.has(

              neighbor.neighbor.id

            )

          ) {

            state.queue.push(

              neighbor.neighbor

            );

          }

        }

      }

      state.depth++;

    }

    return state.result;

  }

}