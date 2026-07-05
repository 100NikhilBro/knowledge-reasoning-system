import type { RetrievalService as IRetrievalService }
from "../contracts/retrieval-service.js";

import { mergeResults }
from "../utils/merge-results.js";

import type { RetrievalQuery }
from "../types/retrieval-query.js";

import type { RetrievalResult }
from "../types/retrieval-result.js";

import { Neo4jGraphRetriever }
from "../graph/graph.retriever.js";

import { DummyVectorRetriever }
from "../vector/vector.retriever.js";

import { SimpleRanker }
from "../ranking/simple-ranker.js";

export class RetrievalService
implements IRetrievalService {

  constructor(

    private readonly graph =
      new Neo4jGraphRetriever(),

    private readonly vector =
      new DummyVectorRetriever(),

    private readonly ranker =
      new SimpleRanker()

  ) {}

  async retrieve(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    const [

      graphResults,

      vectorResults

    ] = await Promise.all([

      this.graph.retrieve(query),

      this.vector.retrieve(query)

    ]);

    const merged = mergeResults(

  graphResults,

  vectorResults

);

    return this.ranker.rank(

      query,

      merged

    );

  }

}