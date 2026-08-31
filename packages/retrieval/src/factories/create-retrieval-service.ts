import {
  createEmbeddingProviderFromEnv,
  EmbeddingService
} from "@knowledge/embeddings";

import {
  assertEmbeddingQdrantDimensions,
  createQdrantVectorStoreFromEnv,
  VectorStoreService
} from "@knowledge/vector-store";

import { Neo4jGraphRetriever }
from "../graph/graph.retriever.js";

import { VectorStoreRetriever }
from "../vector/vector-store.retriever.js";

import { SimpleRanker }
from "../ranking/simple-ranker.js";

import { RetrievalService }
from "../services/retrieval.service.js";

/**
 * Production hybrid retrieval wired from existing env configuration.
 */
export function createRetrievalServiceFromEnv(
  env: NodeJS.ProcessEnv = process.env
): RetrievalService {

  assertEmbeddingQdrantDimensions(env);

  const vectorStore =
    new VectorStoreService(
      createQdrantVectorStoreFromEnv(env),
      new EmbeddingService(
        createEmbeddingProviderFromEnv(env)
      )
    );

  return new RetrievalService(
    new Neo4jGraphRetriever(),
    new VectorStoreRetriever(vectorStore),
    new SimpleRanker()
  );

}
