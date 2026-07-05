import {

  describe,
  expect,
  it

} from "vitest";

import {

  DefaultCitationBuilder

} from "../src/services/citation-builder.service.js";

describe(

  "Citation Builder",

  () => {

    it(

      "should build citations",

      async () => {

        const builder =

          new DefaultCitationBuilder();

        const citations =

          await builder.build({

            evidence: [

              {

                entity: {

                  id: "proposal:PEP-484",

                  type: "Proposal",

                  label: "PEP-484",

                  source: "pep-484.md",

                  confidence: 1,

                  properties: {}

                },

                score: 1,

                source: "graph"

              }

            ]

          });

        expect(

          citations.length

        ).toBe(1);

        expect(

          citations[0].entityId

        ).toBe(

          "proposal:PEP-484"

        );

        expect(

          citations[0].source

        ).toBe(

          "pep-484.md"

        );

      }

    );

  }

);