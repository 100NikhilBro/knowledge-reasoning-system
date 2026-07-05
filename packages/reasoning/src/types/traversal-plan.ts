import type {
  TraversalDepth
} from "./traversal-depth.js";

import type {
  TraversalStrategy
} from "./traversal-strategy.js";

export interface TraversalPlan {

  strategy: TraversalStrategy;

  depth: TraversalDepth;

}