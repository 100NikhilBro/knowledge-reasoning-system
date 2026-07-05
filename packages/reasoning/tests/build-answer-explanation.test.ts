import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildAnswerExplanation

} from "../src/utils/build-answer-explanation.js";

describe(

  "Answer Explanation",

  () => {

    it(

      "builds explanation",

      () => {

        const result =

          buildAnswerExplanation(

            "Python",

            []

          );

        expect(

          result.answer

        ).toBe(

          "Python"

        );

        expect(

          result.reasoning.length

        ).toBeGreaterThan(

          0

        );

      }

    );

  }

);