import {

  describe,

  expect,

  it

} from "vitest";

import {

  startPerformance

} from "../src/utils/start-performance.js";

import {

  endPerformance

} from "../src/utils/end-performance.js";

import {

  buildPerformanceSummary

} from "../src/utils/build-performance-summary.js";

describe(

  "Performance Metrics",

  () => {

    it(

      "tracks execution time",

      () => {

        const start =

          startPerformance();

        const metrics =

          endPerformance(

            start

          );

        expect(

          metrics.duration

        ).toBeGreaterThanOrEqual(

          0

        );

        expect(

          buildPerformanceSummary(

            metrics

          )

        ).toContain(

          "Execution"

        );

      }

    );

  }

);