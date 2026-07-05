import {

  describe,
  expect,
  it

} from "vitest";

import {

  createPipelineContext

} from "../src/utils/create-pipeline-context.js";

import {

  finalizePipelineContext

} from "../src/utils/finalize-pipeline-context.js";

describe(

  "Pipeline Context",

  () => {

    it(

      "creates and finalizes context",

      () => {

        const context =

          createPipelineContext(

            {

              query:

                "What is Docker?"

            }

          );

        expect(

          context.metadata.startedAt

        ).toBeDefined();

        const finalized =

          finalizePipelineContext(

            context,

            {

              answer:

                "Container platform",

              confidence: 0.9,

              citations: []

            }

          );

        expect(

          finalized.result?.answer

        ).toBe(

          "Container platform"

        );

        expect(

          finalized.metadata.finishedAt

        ).toBeDefined();

      }

    );

  }

);