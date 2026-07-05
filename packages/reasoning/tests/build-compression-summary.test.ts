import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildCompressionSummary

} from "../src/utils/build-compression-summary.js";

describe(

  "Compression Summary",

  () => {

    it(

      "computes removed evidence",

      () => {

        const summary =

          buildCompressionSummary(

            10,

            4

          );

        expect(

          summary.original

        ).toBe(

          10

        );

        expect(

          summary.compressed

        ).toBe(

          4

        );

        expect(

          summary.removed

        ).toBe(

          6

        );

      }

    );

  }

);