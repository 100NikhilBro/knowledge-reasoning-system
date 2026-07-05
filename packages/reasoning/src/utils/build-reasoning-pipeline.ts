import type {

  ReasoningPipeline

} from "../types/reasoning-pipeline.js";




export function buildReasoningPipeline(): ReasoningPipeline {

  return {

    stages: [

      "queryRewrite",

      "traversal",

      "ranking",

      "verification",

      "compression",

      "optimization",

      "confidence",

      "explanation"

    ]

  };

}