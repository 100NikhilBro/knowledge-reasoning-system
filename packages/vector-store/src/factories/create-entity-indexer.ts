import {
  createEmbeddingProviderFromEnv,
  EmbeddingService
} from "@knowledge/embeddings";

import type { EntityIndexer } from "../contracts/entity-indexer.js";
import type { VectorStore } from "../contracts/vector-store.js";
import type { IndexingConfig } from "../types/indexing-config.js";

import { assertEmbeddingQdrantDimensions }
from "../config/assert-embedding-qdrant-dimensions.js";

import { resolveIndexingConfig }
from "../config/resolve-indexing-config.js";

import { createQdrantVectorStoreFromEnv }
from "../factories/create-vector-store.js";

import { DefaultEntityIndexer }
from "../services/entity-indexer.service.js";

export function createEntityIndexer(
  store: VectorStore,
  embeddings: EmbeddingService = new EmbeddingService(),
  config?: IndexingConfig
): EntityIndexer {

  return new DefaultEntityIndexer({
    store,
    embeddings,
    config
  });

}

/**
 * Wire indexer from existing embedding + Qdrant environment configuration.
 */
export function createEntityIndexerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  store?: VectorStore,
  embeddings?: EmbeddingService
): EntityIndexer {

  assertEmbeddingQdrantDimensions(env);

  return createEntityIndexer(
    store ?? createQdrantVectorStoreFromEnv(env),
    embeddings
      ?? new EmbeddingService(
        createEmbeddingProviderFromEnv(env)
      ),
    resolveIndexingConfig(env)
  );

}
