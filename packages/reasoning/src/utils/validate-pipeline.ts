import type {

  Pipeline

} from "../types/pipeline.js";

import type {

  PipelineValidation

} from "../types/pipeline-validation.js";

export function validatePipeline(

  pipeline: Pipeline

): PipelineValidation {

  const errors: string[] = [];

  if (

    pipeline.steps.length === 0

  ) {

    errors.push(

      "Pipeline has no steps."

    );

  }

  return {

    valid:

      errors.length === 0,

    errors

  };

}