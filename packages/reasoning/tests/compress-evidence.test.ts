import {

  describe,
  expect,
  it

} from "vitest";

import {

  compressEvidence

} from "../src/utils/compress-evidence.js";

describe(

  "Compress Evidence",

  () => {

    it(

      "merges duplicates",

      () => {

        const evidence = [

          {

            entity: {

              id: "1",

              type: "Paper",

              label: "A",

              source: "paper",

              confidence: 0.5,

              properties: {}

            },

            score: 0.4,

            source: "graph"

          },

          {

            entity: {

              id: "1",

              type: "Paper",

              label: "A",

              source: "paper",

              confidence: 0.9,

              properties: {}

            },

            score: 0.8,

            source: "graph"

          }

        ];

        const result =

          compressEvidence(

            evidence

          );

        expect(

          result

        ).toHaveLength(

          1

        );

        expect(

          result[0].score

        ).toBe(

          0.8

        );

        expect(

          result[0].entity.confidence

        ).toBe(

          0.9

        );

      }

    );

  }

);