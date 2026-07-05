import type {

  ReasoningPipeline

} from "../types/reasoning-pipeline.js";

export function executeReasoningPipeline(

  pipeline: ReasoningPipeline

): string[] {

  return pipeline.stages;

}