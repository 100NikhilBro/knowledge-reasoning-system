import {

  describe,
  expect,
  it

} from "vitest";

import {

  expandSynonyms

} from "../src/utils/expand-synonyms.js";

describe(

  "Expand Synonyms",

  () => {

    it(

      "expands abbreviations",

      () => {

        expect(

          expandSynonyms(

            "js ai api"

          )

        ).toBe(

          "javascript artificial intelligence application programming interface"

        );

      }

    );

  }

);