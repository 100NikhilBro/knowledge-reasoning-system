import {

  describe,

  expect,

  it

} from "vitest";

import {

  buildPipeline

} from "../src/utils/build-pipeline.js";

describe(

  "Build Pipeline",

  () => {

    it(

      "builds execution order",

      () => {

        const pipeline =

          buildPipeline();

        expect(

          pipeline.steps.length

        ).toBe(

          8

        );

        expect(

          pipeline.steps[0].name

        ).toBe(

          "rewrite"

        );

        expect(

          pipeline.steps.at(-1)?.name

        ).toBe(

          "performance"

        );

      }

    );

  }

);