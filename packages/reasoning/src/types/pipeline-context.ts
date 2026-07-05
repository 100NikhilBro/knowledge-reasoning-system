import type {

  ReasoningRequest,
  ReasoningResult

} from "@knowledge/shared";

export interface PipelineContext {

  request: ReasoningRequest;

  result?: ReasoningResult;

  metadata: {

    startedAt: number;

    finishedAt?: number;

  };

}