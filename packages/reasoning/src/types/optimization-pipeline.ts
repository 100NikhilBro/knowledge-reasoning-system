import type {

  HopOptimizer

} from "./hop-optimizer.js";

import type {

  OptimizationSummary

} from "./optimization-summary.js";

export interface OptimizationPipeline {

  optimization: HopOptimizer;

  summary: OptimizationSummary;

}