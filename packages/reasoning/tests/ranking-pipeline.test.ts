import {
  describe,
  expect,
  it
} from "vitest";

import {
  DefaultEvidenceSynthesizer
} from "../src/services/evidence-synthesizer.service.js";

describe(

  "Ranking Pipeline",

  () => {

    it(

      "should rank evidence before returning",

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

                score: 0.8,

                source: "graph"

              }

            ]

          });

        expect(
          result.evidence
        ).toHaveLength(1);

        expect(
          result.evidence[0].score
        ).toBeGreaterThan(0.4);

      }

    );

    it(

      "should filter low scored evidence",

      async () => {

        const synthesizer =
          new DefaultEvidenceSynthesizer();

        const result =
          await synthesizer.synthesize({

            evidence: [

              {

                entity: {

                  id: "2",

                  type: "Proposal",

                  label: "Low Score",

                  source: "pep.md",

                  confidence: 1,

                  properties: {}

                },

                score: 0.2,

                source: "graph"

              }

            ]

          });

        expect(
          result.evidence
        ).toHaveLength(0);

      }

    );

  }

);