import {

  describe,
  expect,
  it

} from "vitest";

import {

  removeStopWords

} from "../src/utils/remove-stopwords.js";

describe(

  "Remove Stop Words",

  () => {

    it(

      "removes common words",

      () => {

        expect(

          removeStopWords(

            "what is the creator of react"

          )

        ).toBe(

          "creator react"

        );

      }

    );

  }

);