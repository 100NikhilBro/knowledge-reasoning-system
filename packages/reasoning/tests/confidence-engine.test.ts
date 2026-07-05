import {

  describe,
  expect,
  it

} from "vitest";

import {

  DefaultConfidenceEngine

} from "../src/services/confidence-engine.service.js";

describe(

  "Confidence Engine",

  () => {

    const engine =

      new DefaultConfidenceEngine();

    it(

      "should return 0 for empty evidence",

      async () => {

        const confidence =

          await engine.calculate({

            evidence: []

          });

        expect(

          confidence

        ).toBe(0);

      }

    );

    it(

      "should return evidence score for one evidence",

      async () => {

        const confidence =

          await engine.calculate({

            evidence: [

              {

                entity: {

                  id: "1",

                  type: "Proposal",

                  label: "PEP-484",

                  source: "pep",

                  confidence: 1,

                  properties: {}

                },

                score: 0.9,

                source: "graph"

              }

            ]

          });

        expect(

          confidence

        ).toBe(0.9);

      }

    );

    it(

      "should average multiple scores",

      async () => {

        const confidence =

          await engine.calculate({

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

                  id: "2",

                  type: "Proposal",

                  label: "B",

                  source: "doc",

                  confidence: 1,

                  properties: {}

                },

                score: 0.6,

                source: "graph"

              }

            ]

          });

        expect(

          confidence

        ).toBe(0.7);

      }

    );

  }

);