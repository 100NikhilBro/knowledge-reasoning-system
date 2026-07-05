// export interface ReasoningPipeline {

//   stages: string[];

// }

import type { PipelineStep } from "./pipeline-step.js";

export interface ReasoningPipeline {
  steps: PipelineStep[];
}