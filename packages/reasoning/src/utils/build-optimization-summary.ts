import type {

  HopChain

} from "../types/hop-chain.js";

import type {

  HopOptimizer

} from "../types/hop-optimizer.js";

import type {

  OptimizationSummary

} from "../types/optimization-summary.js";

export function buildOptimizationSummary(

  original: HopChain,

  optimized: HopOptimizer

): OptimizationSummary {

  return {

    originalHopCount:

      original.hops.length,

    optimizedHopCount:

      optimized.optimized.length,

    removedHopCount:

      original.hops.length -

      optimized.optimized.length

  };

}