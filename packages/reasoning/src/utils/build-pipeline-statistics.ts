import type {

  Pipeline

} from "../types/pipeline.js";

import type {

  PipelineStatistics

} from "../types/pipeline-statistics.js";

export function buildPipelineStatistics(

  pipeline: Pipeline

): PipelineStatistics {

  return {

    totalSteps:

      pipeline.steps.length,

    executedSteps:

      pipeline.steps.length

  };

}