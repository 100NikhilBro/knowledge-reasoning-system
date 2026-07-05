import {

  describe,
  expect,
  it

} from "vitest";

import {

  DefaultEvidenceSynthesizer

} from "../src/services/evidence-synthesizer.service.js";

describe(

  "Evidence Verification Pipeline",

  () => {

    it(

      "should remove invalid evidence before synthesis",

      async () => {

        const synthesizer =

          new DefaultEvidenceSynthesizer();

        const result =

          await synthesizer.synthesize({

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

              },

              {

                entity: {

                  id: "",

                  type: "Proposal",

                  label: "Broken",

                  source: "",

                  confidence: 1,

                  properties: {}

                },

                score: 1,

                source: "graph"

              }

            ]

          });

        expect(

          result.evidence

        ).toHaveLength(1);

      }

    );

  }

);