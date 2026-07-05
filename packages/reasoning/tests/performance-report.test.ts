import {

  describe,

  expect,

  it

} from "vitest";

import {

  buildPerformanceReport

} from "../src/utils/build-performance-report.js";

import {

  renderPerformanceReport

} from "../src/utils/render-performance-report.js";

describe(

  "Performance Report",

  () => {

    it(

      "builds report",

      () => {

        const report =

          buildPerformanceReport(

            {

              startTime: 0,

              endTime: 10,

              duration: 10

            }

          );

        expect(

          report.metrics.duration

        ).toBe(

          10

        );

        expect(

          renderPerformanceReport(

            report

          )

        ).toContain(

          "Duration"

        );

      }

    );

  }

);