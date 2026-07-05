import {

  describe,

  expect,

  it

} from "vitest";

import {

  buildPipeline

} from "../src/utils/build-pipeline.js";

import {

  buildPipelineStatistics

} from "../src/utils/build-pipeline-statistics.js";

describe(

  "Pipeline Statistics",

  () => {

    it(

      "builds statistics",

      () => {

        const pipeline =

          buildPipeline();

        const stats =

          buildPipelineStatistics(

            pipeline

          );

        expect(

          stats.totalSteps

        ).toBe(

          8

        );

        expect(

          stats.executedSteps

        ).toBe(

          8

        );

      }

    );

  }

);