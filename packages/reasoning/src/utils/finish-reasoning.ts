// import type { ReasoningPipeline } from "../types/reasoning-pipeline.js";
// import type { PipelineStatistics } from "../types/pipeline-statistics.js";
// import type { ReasoningResult } from "../types/reasoning-result.js";

// export function finishReasoning(

//   pipeline: ReasoningPipeline,

//   statistics: PipelineStatistics

// ): ReasoningResult {

//   return {

//     pipeline,

//     statistics

//   };

// }



import type { ReasoningPipeline } from "../types/reasoning-pipeline.js";
import type { PipelineStatistics } from "../types/pipeline-statistics.js";
import type { ReasoningResult } from "../types/reasoning-result.js";

export function finishReasoning(

  pipeline: ReasoningPipeline,

  statistics: PipelineStatistics

): ReasoningResult {

  return {

    answer: "Reasoning completed successfully.",

    pipeline,

    statistics

  };

}