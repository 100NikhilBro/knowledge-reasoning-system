import type { VectorStore } from "../contracts/vector-store.js";
import type { VectorStoreConfig } from "../types/vector-store-config.js";
import type { QdrantClientPort } from "../contracts/qdrant-client-port.js";

import { assertEmbeddingQdrantDimensions }
from "../config/assert-embedding-qdrant-dimensions.js";

import { resolveVectorStoreConfig }
from "../config/resolve-vector-store-config.js";

import { createQdrantClient }
from "../qdrant/create-qdrant-client.js";

import { QdrantVectorStore }
from "../qdrant/qdrant-vector-store.js";

export function createQdrantVectorStore(
  config: VectorStoreConfig,
  client?: QdrantClientPort
): VectorStore {

  return new QdrantVectorStore({
    config,
    client: client ?? createQdrantClient(config)
  });

}

export function createQdrantVectorStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  client?: QdrantClientPort
): VectorStore {

  assertEmbeddingQdrantDimensions(env);

  return createQdrantVectorStore(
    resolveVectorStoreConfig(env),
    client
  );

}
