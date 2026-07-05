import type {

  HopChain

} from "../types/hop-chain.js";

import type {

  HopOptimizer

} from "../types/hop-optimizer.js";

export function optimizeHopChain(

  chain: HopChain,

  maxHops: number

): HopOptimizer {

  return {

    optimized:

      chain.hops.slice(

        0,

        maxHops

      )

  };

}