import type { VectorRetriever }
from "../contracts/vector-retriever.js";

import type { RetrievalQuery }
from "../types/retrieval-query.js";

import type { RetrievalResult }
from "../types/retrieval-result.js";

export class DummyVectorRetriever
implements VectorRetriever {

  async retrieve(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    return [];

  }

}