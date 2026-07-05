import type {

  EngineContext

} from "./engine-context.js";

export interface MasterReasoningEngine {

  execute(

    context: EngineContext

  ): EngineContext;

}