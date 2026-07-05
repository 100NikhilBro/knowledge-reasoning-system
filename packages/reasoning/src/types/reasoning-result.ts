import type { ReasoningPipeline } from "./reasoning-pipeline.js";
import type { PipelineStatistics } from "./pipeline-statistics.js";

export interface ReasoningResult {

  pipeline: ReasoningPipeline;

  statistics: PipelineStatistics;

}