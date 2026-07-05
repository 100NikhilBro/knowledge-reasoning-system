// import {

//   describe,
//   expect,
//   it

// } from "vitest";

// import {

//   buildRankingBreakdown

// } from "../src/utils/build-ranking-breakdown.js";

// describe(

//   "Ranking Breakdown",

//   () => {

//     it(

//       "builds weighted score",

//       () => {

//         const result =

//           buildRankingBreakdown(

//             {

//               entity: {

//                 id: "1",

//                 type: "Proposal",

//                 label: "PEP",

//                 source: "pep.md",

//                 confidence: 1,

//                 properties: {}

//               },

//               score: 1,

//               source: "graph"

//             },

//             {

//               retrieval: 0.6,

//               graph: 0,

//               trust: 0.2,

//               confidence: 0.2

//             }

//           );

//         expect(

//           result.final

//         ).toBeCloseTo(

//           0.99

//         );

//       }

//     );

//   }

// );


import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildRankingBreakdown

} from "../src/utils/build-ranking-breakdown.js";

describe(

  "Ranking Breakdown",

  () => {

    it(

      "builds weighted score",

      () => {

        const result =

          buildRankingBreakdown(

            {

              entity: {

                id: "1",

                type: "Proposal",

                label: "PEP",

                source: "pep.md",

                confidence: 1,

                properties: {}

              },

              score: 1,

              source: "graph"

            },

            {

              minimumScore: 0.5,

              weights: {

                retrieval: 0.6,

                trust: 0.2,

                confidence: 0.2

              }

            }

          );

        expect(

          result.retrieval

        ).toBeCloseTo(

          0.6

        );

        expect(

          result.trust

        ).toBeCloseTo(

          0.19

        );

        expect(

          result.confidence

        ).toBeCloseTo(

          0.2

        );

        expect(

          result.final

        ).toBeCloseTo(

          0.99

        );

      }

    );

  }

);