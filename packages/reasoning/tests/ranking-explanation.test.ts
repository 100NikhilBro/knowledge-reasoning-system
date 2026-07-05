import {

  describe,
  expect,
  it

} from "vitest";

import {

  DefaultEvidenceRanker

} from "../src/services/evidence-ranker.service.js";

describe(

  "Ranking Explanation",

  () => {

    it(

      "should explain ranking",

      () => {

        const ranker =

          new DefaultEvidenceRanker();

        const explanation =

          ranker.explain({

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

          });

        expect(

          explanation.finalScore

        ).toBe(

          0.8

        );

      }

    );

  }

);