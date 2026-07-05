import {

  describe,
  expect,
  it

} from "vitest";

import {

  rewriteQuery

} from "../src/utils/rewrite-query.js";

describe(

  "Rewrite Query",

  () => {

    it(

      "normalizes query",

      () => {

  const result = rewriteQuery(

  "WHAT IS NODE"

);

expect(

  result.rewritten

).toBe(

  "node.js"

);

      }

    );

  }

);