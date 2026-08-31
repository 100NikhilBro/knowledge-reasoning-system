export type {
  VectorStore
} from "./contracts/vector-store.js";

export type {
  QdrantClientPort
} from "./contracts/qdrant-client-port.js";

export type {
  EntityIndexer
} from "./contracts/entity-indexer.js";

export type {
  VectorStoreConfig,
  VectorDistance
} from "./types/vector-store-config.js";

export type {
  VectorRecord
} from "./types/vector-record.js";

export type {
  VectorSearchQuery
} from "./types/vector-search-query.js";

export type {
  IndexingOptions
} from "./types/indexing-options.js";

export type {
  IndexingResult
} from "./types/indexing-result.js";

export type {
  IndexingConfig
} from "./types/indexing-config.js";

export {
  VectorStoreError
} from "./errors/vector-store-error.js";

export {
  resolveVectorStoreConfig
} from "./config/resolve-vector-store-config.js";

export {
  assertEmbeddingQdrantDimensions
} from "./config/assert-embedding-qdrant-dimensions.js";

export {
  resolveIndexingConfig
} from "./config/resolve-indexing-config.js";

export {
  toPointId
} from "./utils/to-point-id.js";

export {
  extractCollectionVectorSize
} from "./utils/collection-vector-size.js";

export {
  buildEntityEmbeddingText
} from "./utils/build-entity-embedding-text.js";

export {
  QdrantVectorStore
} from "./qdrant/qdrant-vector-store.js";

export type {
  QdrantVectorStoreOptions
} from "./qdrant/qdrant-vector-store.js";

export {
  createQdrantClient
} from "./qdrant/create-qdrant-client.js";

export {
  VectorStoreService
} from "./services/vector-store.service.js";

export type {
  UpsertEmbeddedEntitiesInput
} from "./services/vector-store.service.js";

export {
  DefaultEntityIndexer
} from "./services/entity-indexer.service.js";

export type {
  DefaultEntityIndexerOptions
} from "./services/entity-indexer.service.js";

export {
  createQdrantVectorStore,
  createQdrantVectorStoreFromEnv
} from "./factories/create-vector-store.js";

export {
  createEntityIndexer,
  createEntityIndexerFromEnv
} from "./factories/create-entity-indexer.js";
