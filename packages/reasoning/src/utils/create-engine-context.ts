import type {

  ReasoningRequest

} from "@knowledge/shared";

import type {

  EngineContext

} from "../types/engine-context.js";

export function createEngineContext(

  request: ReasoningRequest

): EngineContext {

  return {

    request

  };

}