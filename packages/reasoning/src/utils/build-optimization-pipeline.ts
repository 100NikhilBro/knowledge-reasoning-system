import type {

  HopChain

} from "../types/hop-chain.js";

import type {

  OptimizationPipeline

} from "../types/optimization-pipeline.js";

import {

  optimizeHopChain

} from "./optimize-hop-chain.js";

import {

  buildOptimizationSummary

} from "./build-optimization-summary.js";

export function buildOptimizationPipeline(

  chain: HopChain,

  maxHops: number

): OptimizationPipeline {

  const optimization =

    optimizeHopChain(

      chain,

      maxHops

    );

  const summary =

    buildOptimizationSummary(

      chain,

      optimization

    );

  return {

    optimization,

    summary

  };

}