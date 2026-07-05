// import type { ReasoningPipeline } from "./reasoning-pipeline.js";
// import type { PipelineStatistics } from "./pipeline-statistics.js";

// export interface ReasoningResult {

//   pipeline: ReasoningPipeline;

//   statistics: PipelineStatistics;

// }


import type { ReasoningPipeline } from "./reasoning-pipeline.js";
import type { PipelineStatistics } from "./pipeline-statistics.js";

export interface ReasoningResult {

  answer: string;

  pipeline: ReasoningPipeline;

  statistics: PipelineStatistics;

}