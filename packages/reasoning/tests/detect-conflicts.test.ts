import {

  describe,
  expect,
  it

} from "vitest";

import {

  detectConflicts

} from "../src/utils/detect-conflicts.js";

describe(

  "Conflict Detection",

  () => {

    it(

      "detects conflicting sources",

      () => {

        const entity = {

          id: "PEP-484",

          type: "Proposal",

          label: "PEP-484",

          source: "pep.md",

          confidence: 1,

          properties: {}

        };

        const conflicts =

          detectConflicts([

            {

              entity,

              score: 1,

              source: "graph"

            },

            {

              entity,

              score: 0.9,

              source: "vector"

            }

          ]);

        expect(

          conflicts

        ).toHaveLength(1);

      }

    );

  }

);