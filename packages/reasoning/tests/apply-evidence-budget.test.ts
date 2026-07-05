import {

  describe,
  expect,
  it

} from "vitest";

import {

  applyEvidenceBudget

} from "../src/utils/apply-evidence-budget.js";

describe(

  "Apply Evidence Budget",

  () => {

    it(

      "limits evidence",

      () => {

        const evidence =

          Array.from(

            {

              length: 10

            },

            (_, i) => ({

              entity: {

                id: String(i),

                label: String(i),

                type: "Paper",

                source: "paper",

                confidence: 1,

                properties: {}

              },

              score: i,

              source: "graph"

            })

          );

        const result =

          applyEvidenceBudget(

            evidence,

            {

              maxEvidence: 3

            }

          );

        expect(

          result

        ).toHaveLength(

          3

        );

      }

    );

  }

);