import {

  describe,

  expect,

  it

} from "vitest";

import {

  buildPipeline

} from "../src/utils/build-pipeline.js";

import {

  validatePipeline

} from "../src/utils/validate-pipeline.js";

describe(

  "Validate Pipeline",

  () => {

    it(

      "validates pipeline",

      () => {

        const pipeline =

          buildPipeline();

        const result =

          validatePipeline(

            pipeline

          );

        expect(

          result.valid

        ).toBe(

          true

        );

        expect(

          result.errors

        ).toHaveLength(

          0

        );

      }

    );

  }

);