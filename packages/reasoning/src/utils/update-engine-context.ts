import type {

  EngineContext

} from "../types/engine-context.js";

export function updateEngineContext(

  context: EngineContext,

  values: Partial<EngineContext>

): EngineContext {

  return {

    ...context,

    ...values

  };

}