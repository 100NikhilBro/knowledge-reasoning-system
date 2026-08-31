import type { VectorRetriever }
from "../contracts/vector-retriever.js";

import type { RetrievalQuery }
from "../types/retrieval-query.js";

import type { RetrievalResult }
from "../types/retrieval-result.js";

/**
 * No-op vector retriever for graph-only setups and tests.
 */
export class DummyVectorRetriever
implements VectorRetriever {

  async retrieve(
    _query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    return [];

  }

}
