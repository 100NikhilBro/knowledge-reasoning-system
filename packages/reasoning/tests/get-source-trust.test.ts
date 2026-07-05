import {

  describe,
  expect,
  it

} from "vitest";

import {

  getSourceTrust

} from "../src/utils/get-source-trust.js";

describe(

  "Source Trust",

  () => {

    it(

      "returns graph trust",

      () => {

        expect(

          getSourceTrust(

            "graph"

          )

        ).toBe(0.95);

      }

    );

    it(

      "returns default trust",

      () => {

        expect(

          getSourceTrust(

            "unknown"

          )

        ).toBe(0.5);

      }

    );

  }

);