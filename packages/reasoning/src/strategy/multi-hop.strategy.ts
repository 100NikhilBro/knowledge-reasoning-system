// import type {
//   EvidenceSet,
//   ReasoningPlan
// } from "@knowledge/shared";

// import type {
//   ReasoningStrategy
// } from "./reasoning-strategy.js";


// import { GraphTraversalService } from "@knowledge/graph";


// export class MultiHopStrategy
// implements ReasoningStrategy {

//   async execute(

//   graph: GraphTraversalService,

//   _plan: ReasoningPlan,

//   evidence: EvidenceSet

// ): Promise<EvidenceSet> {

//   const expanded = [

//     ...evidence.evidence

//   ];

//   for (const item of evidence.evidence) {

//     const neighbors =

//       await graph.findNeighbors(

//         item.entity.type,

//         item.entity.id

//       );

//     for (const neighbor of neighbors) {

//       expanded.push({

//         entity: neighbor.neighbor,

//         score: 0.75,

//         source: "graph"

//       });

//     }

//   }

//   return {

//     evidence: expanded

//   };

// }

// }




import type {
  Evidence,
  EvidenceSet,
  ReasoningPlan
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  ReasoningStrategy
} from "./reasoning-strategy.js";

import {
  BFSTraversal
} from "../traversal/bfs-traversal.js";

import {

  TraversalFactory

} from "../traversal/traversal-factory.js";

export class MultiHopStrategy
implements ReasoningStrategy {

  // private readonly traversal =
  //   new BFSTraversal();

  async execute(

    graph: GraphTraversalService,

    plan: ReasoningPlan,

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    const traversal =

  TraversalFactory.create(

    plan.traversal

  );

const nodes =

  await traversal.traverse(

    graph,

    evidence,

    plan.maxDepth

  );
    const expanded: Evidence[] =

      nodes.map(node => ({

        entity: node,

        score: 0.75,

        source: "graph"

      }));

    return {

      evidence: expanded

    };

  }

}