import { describe, expect, it } from "vitest";

import {

  buildReasoningPipeline

} from "../src/utils/build-reasoning-pipeline.js";

describe(

  "Reasoning Pipeline",

  () => {

    it(

      "builds pipeline",

      () => {

        const pipeline =

          buildReasoningPipeline();

        expect(

          pipeline.stages.length

        ).toBeGreaterThan(0);

      }

    );

  }

);