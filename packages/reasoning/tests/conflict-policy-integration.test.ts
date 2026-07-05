import {
  describe,
  expect,
  it
} from "vitest";

import {
  resolveConflicts
} from "../src/utils/resolve-conflicts.js";

describe(

  "Conflict Policy Integration",

  () => {

    it(

      "supports keep-all policy",

      () => {

        const evidence = [];

        const result =

          resolveConflicts(

            evidence,

            [],

            "keep-all"

          );

        expect(

          result.resolved

        ).toBe(

          evidence

        );

      }

    );

  }

);