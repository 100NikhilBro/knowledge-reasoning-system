export type {
  EmbeddingProvider
} from "./contracts/embedding-provider.js";

export type {
  EmbeddingVector
} from "./types/embedding-vector.js";

export type {
  EmbeddingResult
} from "./types/embedding-result.js";

export type {
  EmbeddingConfig,
  EmbeddingProviderKind
} from "./types/embedding-config.js";

export {
  EmbeddingError
} from "./errors/embedding-error.js";

export {
  DeterministicEmbeddingProvider
} from "./providers/deterministic.embedding-provider.js";

export type {
  DeterministicEmbeddingProviderOptions
} from "./providers/deterministic.embedding-provider.js";

export {
  OpenAICompatibleEmbeddingProvider
} from "./providers/openai-compatible.embedding-provider.js";

export type {
  OpenAICompatibleEmbeddingProviderOptions
} from "./providers/openai-compatible.embedding-provider.js";

export {
  EmbeddingService
} from "./services/embedding.service.js";

export {
  resolveEmbeddingConfig
} from "./config/resolve-embedding-config.js";

export {
  createEmbeddingProvider,
  createEmbeddingProviderFromEnv
} from "./factories/create-embedding-provider.js";

export {
  sanitizeProviderText
} from "./utils/sanitize-provider-text.js";
