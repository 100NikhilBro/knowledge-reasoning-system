import type {

  EngineContext

} from "../types/engine-context.js";

import type {

  MasterReasoningEngine

} from "../types/master-reasoning-engine.js";


import {

  buildPipelineStatistics

} from "./build-pipeline-statistics.js";

import {

  validatePipeline

} from "./validate-pipeline.js";

import {

  buildPipeline

} from "./build-pipeline.js";

export class DefaultMasterReasoningEngine
  implements MasterReasoningEngine {

  execute(

    context: EngineContext

  ): EngineContext {

    const pipeline =

  buildPipeline();

const validation =

  validatePipeline(

    pipeline

  );

if (

  !validation.valid

) {

  throw new Error(

    validation.errors.join(

      ", "

    )

  );

}

const statistics =

  buildPipelineStatistics(

    pipeline

  );

void statistics;

return context;

  }

}