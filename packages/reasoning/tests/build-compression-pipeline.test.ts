import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildCompressionPipeline

} from "../src/utils/build-compression-pipeline.js";

describe(

  "Compression Pipeline",

  () => {

    it(

      "compresses and limits evidence",

      () => {

        const evidence =

          Array.from(

            { length: 20 },

            (_, i) => ({

              entity: {

                id: String(i),

                label: String(i),

                type: "Paper",

                source: "paper",

                confidence: 1,

                properties: {}

              },

              score: i,

              source: "graph"

            })

          );

        const result =

          buildCompressionPipeline(

            evidence,

            5

          );

        expect(

          result.evidence

        ).toHaveLength(

          5

        );

        expect(

          result.summary.original

        ).toBe(

          20

        );

        expect(

          result.summary.compressed

        ).toBe(

          5

        );

      }

    );

  }

);