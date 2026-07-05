// import type { RetrievalQuery } from "../types/retrieval-query.js";
// import type { RetrievalResult } from "../types/retrieval-result.js";

// export interface Ranker {

//   rank(
//     query: RetrievalQuery,
//     results: RetrievalResult[]
//   ): Promise<RetrievalResult[]>;

// }


import type { RetrievalQuery } from "../types/retrieval-query.js";
import type { RetrievalResult } from "../types/retrieval-result.js";

export interface Ranker {

  rank(

    query: RetrievalQuery,

    results: RetrievalResult[]

  ): Promise<RetrievalResult[]>;

}