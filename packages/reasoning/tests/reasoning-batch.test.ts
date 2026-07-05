import {

  describe,

  expect,

  it

} from "vitest";

import {

  createReasoningBatch

} from "../src/utils/create-reasoning-batch.js";

import {

  processReasoningBatch

} from "../src/utils/process-reasoning-batch.js";

import {

  buildBatchSummary

} from "../src/utils/build-batch-summary.js";

describe(

  "Reasoning Batch",

  () => {

    it(

      "processes multiple requests",

      () => {

        const batch =

          createReasoningBatch(

            [1, 2, 3]

          );

        const output =

          processReasoningBatch(

            batch,

            value => value * 2

          );

        expect(

          output

        ).toEqual(

          [2, 4, 6]

        );

        expect(

          buildBatchSummary(

            batch

          )

        ).toContain(

          "3"

        );

      }

    );

  }

);