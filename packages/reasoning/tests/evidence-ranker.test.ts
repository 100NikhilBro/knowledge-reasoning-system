import {

  describe,
  expect,
  it

} from "vitest";

import {

  DefaultEvidenceRanker

} from "../src/services/evidence-ranker.service.js";

describe(

  "Evidence Ranker",

  () => {

    it(

      "should rank evidence",

      () => {

        const ranker =

          new DefaultEvidenceRanker();

        const result =

          ranker.rank({

            entity: {

              id: "1",

              type: "Proposal",

              label: "PEP-484",

              source: "pep.md",

              confidence: 1,

              properties: {}

            },

            score: 0.5,

            source: "graph"

          });

        expect(

          result.score

        ).toBeGreaterThan(

          0.5

        );

      }

    );

  }

);


it(

  "should rank collection",

  () => {

    const ranker =

      new DefaultEvidenceRanker();

    const result =

      ranker.rankAll([

        {

          entity: {

            id: "1",

            type: "Proposal",

            label: "PEP",

            source: "pep.md",

            confidence: 1,

            properties: {}

          },

          score: 0.5,

          source: "graph"

        }

      ]);

    expect(

      result

    ).toHaveLength(

      1

    );

    expect(

      result[0].score

    ).toBeGreaterThan(

      0.5

    );

  }

);

it(

  "should explain ranked evidence",

  () => {

    const ranker =

      new DefaultEvidenceRanker();

    const ranked =

      ranker.rank({

        entity: {

          id: "1",

          type: "Proposal",

          label: "PEP-484",

          source: "pep.md",

          confidence: 1,

          properties: {}

        },

        score: 0.5,

        source: "graph"

      });

    const explanation =

      ranker.explain(

        ranked

      );

    expect(

      explanation.finalScore

    ).toBe(

      ranked.score

    );

  }

);

it(

  "supports custom ranking config",

  () => {

    const ranker =

      new DefaultEvidenceRanker({

        minimumScore: 0.1,

        weights: {

          retrieval: 1,

          trust: 0,

          confidence: 0

        }

      });

    const result =

      ranker.rank({

        entity: {

          id: "1",

          type: "Proposal",

          label: "PEP",

          source: "pep.md",

          confidence: 1,

          properties: {}

        },

        score: 0.5,

        source: "graph"

      });

    expect(

      result.score

    ).toBe(

      0.5

    );

  }

);