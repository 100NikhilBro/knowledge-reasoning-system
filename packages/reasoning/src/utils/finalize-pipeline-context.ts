import type {

  ReasoningResult

} from "@knowledge/shared";

import type {

  PipelineContext

} from "../types/pipeline-context.js";

export function finalizePipelineContext(

  context: PipelineContext,

  result: ReasoningResult

): PipelineContext {

  return {

    ...context,

    result,

    metadata: {

      ...context.metadata,

      finishedAt: Date.now()

    }

  };

}