import {
  describe,
  expect,
  it
} from "vitest";

import {
  DEFAULT_CONFLICT_POLICY
} from "../src/utils/default-conflict-policy.js";

describe(

  "Default Conflict Policy",

  () => {

    it(

      "uses highest confidence",

      () => {

        expect(

          DEFAULT_CONFLICT_POLICY

        ).toBe(

          "highest-confidence"

        );

      }

    );

  }

);