import { buildReasoningPipeline } from "./build-reasoning-pipeline.js";
import { validatePipeline } from "./validate-pipeline.js";
import { executeReasoningPipeline } from "./execute-reasoning-pipeline.js";
import { buildPipelineStatistics } from "./build-pipeline-statistics.js";
import { finishReasoning } from "./finish-reasoning.js";

import type { ReasoningResult } from "../types/reasoning-result.js";

export function orchestrateReasoning(): ReasoningResult {

  const pipeline = buildReasoningPipeline();

  validatePipeline(pipeline);

  executeReasoningPipeline(pipeline);

  const statistics =
    buildPipelineStatistics(pipeline);

  return finishReasoning(

    pipeline,

    statistics

  );

}