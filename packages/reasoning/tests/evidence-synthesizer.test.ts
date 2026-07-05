import {

  describe,
  expect,
  it

} from "vitest";

import {

  DefaultEvidenceSynthesizer

} from "../src/services/evidence-synthesizer.service.js";

describe(

  "Evidence Synthesizer",

  () => {

    it(

      "should deduplicate filter and sort evidence",

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

                  label: "A",

                  source: "doc",

                  confidence: 1,

                  properties: {}

                },

                score: 0.8,

                source: "graph"

              },

              {

                entity: {

                  id: "1",

                  type: "Proposal",

                  label: "A",

                  source: "doc",

                  confidence: 1,

                  properties: {}

                },

                score: 0.9,

                source: "graph"

              },

              {

                entity: {

                  id: "2",

                  type: "Proposal",

                  label: "B",

                  source: "doc",

                  confidence: 1,

                  properties: {}

                },

                score: 0.2,

                source: "graph"

              }

            ]

          });

        expect(

          result.evidence.length

        ).toBe(1);

        expect(

  result.evidence[0].score

).toBeCloseTo(

  0.93

);

      }

    );

  }

);