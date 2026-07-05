import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildExplanationPipeline

} from "../src/utils/build-explanation-pipeline.js";

describe(

  "Explanation Pipeline",

  () => {

    it(

      "combines explanation and trace",

      () => {

        const result =

          buildExplanationPipeline(

            {

              answer: "Python",

              reasoning: [

                "ranked"

              ]

            },

            {

              query: "Python",

              traversal: [

                "Python"

              ],

              evidenceCount: 2,

              conflicts: 0,

              confidence: 0.95

            }

          );

        expect(

          result.explanation.answer

        ).toBe(

          "Python"

        );

        expect(

          result.trace.confidence

        ).toBe(

          0.95

        );

      }

    );

  }

);