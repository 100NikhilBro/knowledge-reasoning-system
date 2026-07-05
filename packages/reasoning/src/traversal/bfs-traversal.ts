import type {
  EvidenceSet,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  GraphTraversal
} from "../contracts/graph-traversal.js";

export class BFSTraversal
implements GraphTraversal {

  async traverse(

    graph: GraphTraversalService,

    evidence: EvidenceSet,

    depth: number

  ): Promise<KnowledgeEntity[]> {

    const queue =

      evidence.evidence.map(

        item => item.entity

      );

    const visited =

      new Set<string>();

    const result: KnowledgeEntity[] = [];

    let currentDepth = 0;

    while (

      queue.length &&
      currentDepth < depth

    ) {

      const size = queue.length;

      for (

        let i = 0;

        i < size;

        i++

      ) {

        const node = queue.shift()!;

        if (

          visited.has(node.id)

        ) {

          continue;

        }

        visited.add(node.id);

        result.push(node);

        const neighbors =

          await graph.findNeighbors(

            node.type,

            node.id

          );

        for (

          const neighbor of neighbors

        ) {

          queue.push(

            neighbor.neighbor

          );

        }

      }

      currentDepth++;

    }

    return result;

  }

}