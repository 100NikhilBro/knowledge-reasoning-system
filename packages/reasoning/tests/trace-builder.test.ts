import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildTrace

} from "../src/utils/trace-builder.js";

describe(

  "Trace Builder",

  () => {

    it(

      "should create reasoning steps",

      () => {

        const trace =

          buildTrace({

            evidence: [

              {

                entity: {

                  id: "1",

                  type: "Proposal",

                  label: "PEP-484",

                  source: "pep.md",

                  confidence: 1,

                  properties: {}

                },

                score: 1,

                source: "graph"

              }

            ]

          });

        expect(

          trace.steps.length

        ).toBe(1);

      }

    );

  }

);