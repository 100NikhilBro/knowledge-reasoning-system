import {

  describe,
  expect,
  it

} from "vitest";

import {

  queryRewritePipeline

} from "../src/utils/query-rewrite-pipeline.js";

describe(

  "Query Rewrite Pipeline",

  () => {

    it(

      "runs the full rewrite pipeline",

      () => {

        expect(

          queryRewritePipeline(

            "WHAT IS JS"

          )

        ).toBe(

          "javascript"

        );

      }

    );

  }

);