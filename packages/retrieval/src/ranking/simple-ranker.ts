// // import type { Ranker } from "../contracts/ranker.js";
// // import type { RetrievalQuery } from "../types/retrieval-query.js";
// // import type { RetrievalResult } from "../types/retrieval-result.js";

// // export class SimpleRanker implements Ranker {

// //   async rank(
// //     query: RetrievalQuery,
// //     results: RetrievalResult[]
// //   ): Promise<RetrievalResult[]> {

// //     return [...results].sort(

// //       (a, b) => b.score - a.score

// //     );

// //   }

// // }


// import type { Ranker } from "../contracts/ranker.js";

// import type { RetrievalQuery } from "../types/retrieval-query.js";

// import type { RetrievalResult } from "../types/retrieval-result.js";

// export class SimpleRanker implements Ranker {

//   async rank(

//     query: RetrievalQuery,

//     results: RetrievalResult[]

//   ): Promise<RetrievalResult[]> {

//     return [...results].sort(

//       (a, b) => b.score - a.score

//     );

//   }

// }


import type { Ranker }
from "../contracts/ranker.js";

import type { RetrievalQuery }
from "../types/retrieval-query.js";

import type { RetrievalResult }
from "../types/retrieval-result.js";

import { calculateScore }
from "./score.js";

export class SimpleRanker
implements Ranker {

  async rank(

    query: RetrievalQuery,

    results: RetrievalResult[]

  ): Promise<RetrievalResult[]> {

    const ranked = results.map(result => ({

      ...result,

      score: calculateScore(
        result.entity
      )

    }));

    ranked.sort(

      (a, b) => b.score - a.score

    );

    return ranked;

  }

}