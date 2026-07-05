import {

  describe,
  expect,
  it

} from "vitest";

import {

  canonicalizeEntities

} from "../src/utils/canonicalize-entities.js";

describe(

  "Canonicalize Entities",

  () => {

    it(

      "canonicalizes aliases",

      () => {

        expect(

          canonicalizeEntities(

            "node reactjs mongodb gpt4"

          )

        ).toBe(

          "node.js react mongo gpt-4"

        );

      }

    );

  }

);