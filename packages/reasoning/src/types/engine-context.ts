import type {

  ReasoningRequest,
  ReasoningResult

} from "@knowledge/shared";

import type { Evidence } from "@knowledge/shared";

export interface EngineContext {

  request: ReasoningRequest;

  collected?: Evidence[];

  synthesized?: Evidence[];

  result?: ReasoningResult;

}