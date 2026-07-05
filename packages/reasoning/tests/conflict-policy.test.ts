import {

  describe,

  expect,

  it

} from "vitest";

import type {

  ConflictPolicy

} from "../src/types/conflict-policy.js";

describe(

  "Conflict Policy",

  () => {

    it(

      "supports merge policy",

      () => {

        const policy: ConflictPolicy =

          "merge";

        expect(

          policy

        ).toBe(

          "merge"

        );

      }

    );

  }

);