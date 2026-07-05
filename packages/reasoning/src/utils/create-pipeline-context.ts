import type {

  ReasoningRequest

} from "@knowledge/shared";

import type {

  PipelineContext

} from "../types/pipeline-context.js";

export function createPipelineContext(

  request: ReasoningRequest

): PipelineContext {

  return {

    request,

    metadata: {

      startedAt:

        Date.now()

    }

  };

}