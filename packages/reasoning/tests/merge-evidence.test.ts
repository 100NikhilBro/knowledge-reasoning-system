import {

  describe,
  expect,
  it

} from "vitest";

import {

  mergeEvidence

} from "../src/utils/merge-evidence.js";

describe(

  "Merge Evidence",

  () => {

    it(

      "keeps highest score and confidence",

      () => {

        const merged =

          mergeEvidence(

            {

              entity: {

                id: "1",

                type: "Proposal",

                label: "PEP",

                source: "pep.md",

                confidence: 0.4,

                properties: {}

              },

              score: 0.6,

              source: "graph"

            },

            {

              entity: {

                id: "1",

                type: "Proposal",

                label: "PEP",

                source: "pep.md",

                confidence: 0.9,

                properties: {}

              },

              score: 0.8,

              source: "graph"

            }

          );

        expect(

          merged.score

        ).toBe(

          0.8

        );

        expect(

          merged.entity.confidence

        ).toBe(

          0.9

        );

      }

    );

  }

);