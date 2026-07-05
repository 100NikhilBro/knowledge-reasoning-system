import {

  describe,
  expect,
  it

} from "vitest";

import {

  renderComparison

} from "../src/utils/render-comparison.js";

describe(

  "Render Comparison",

  () => {

    it(

      "renders comparison",

      () => {

        const answer =

          renderComparison({

            common: [

              "Typing"

            ],

            leftOnly: [

              "PEP-484"

            ],

            rightOnly: [

              "PEP-544"

            ]

          });

        expect(

          answer

        ).toContain(

          "Common"

        );

      }

    );

  }

);