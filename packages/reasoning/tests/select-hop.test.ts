import {

  describe,
  expect,
  it

} from "vitest";

import {

  selectHop

} from "../src/utils/select-hop.js";

describe(

  "Select Hop",

  () => {

    it(

      "selects useful hop",

      () => {

        expect(

          selectHop(

            1,

            0.9

          ).selected

        ).toBe(

          true

        );

        expect(

          selectHop(

            5,

            0.5

          ).selected

        ).toBe(

          false

        );

      }

    );

  }

);