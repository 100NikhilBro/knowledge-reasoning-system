import { describe, expect, it } from "vitest";

import {

  buildReasoningPipeline

} from "../src/utils/build-reasoning-pipeline.js";

import {

  executeReasoningPipeline

} from "../src/utils/execute-reasoning-pipeline.js";

describe(

  "Execute Pipeline",

  () => {

    it(

      "runs every stage",

      () => {

        const pipeline =

          buildReasoningPipeline();

        expect(

          executeReasoningPipeline(

            pipeline

          )

        ).toEqual(

          pipeline.stages

        );

      }

    );

  }

);