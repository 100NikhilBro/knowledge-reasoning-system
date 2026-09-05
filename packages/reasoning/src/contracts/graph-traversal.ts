import type {
  EvidenceSet
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  TraversalHit
} from "../types/traversal-hit.js";

/**
 * Graph traversal that preserves real relationship/path provenance.
 */
export interface GraphTraversal {

  traverse(

    graph: GraphTraversalService,

    evidence: EvidenceSet,

    depth: number

  ): Promise<TraversalHit[]>;

}
