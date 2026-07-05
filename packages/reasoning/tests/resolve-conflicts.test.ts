import {
  describe,
  expect,
  it
} from "vitest";

import {
  resolveConflicts
} from "../src/utils/resolve-conflicts.js";

describe(

  "Conflict Resolver",

  () => {

    it(

      "returns unresolved conflicts",

      () => {

        const entity = {

          id: "1",

          type: "Proposal",

          label: "PEP-484",

          source: "pep.md",

          confidence: 1,

          properties: {}

        };

        const evidence = [

          {

            entity,

            score: 1,

            source: "graph" as const

          }

        ];

        const conflicts = [

          {

            entityId: "1",

            left: evidence[0],

            right: {

              entity,

              score: 0.8,

              source: "vector" as const

            },

            reason: "Conflicting sources"

          }

        ];

        const result =

          resolveConflicts(

            evidence,

            conflicts

          );

        expect(

          result.resolved

        ).toHaveLength(1);

        expect(

          result.unresolved

        ).toHaveLength(1);

      }

    );

  }

);