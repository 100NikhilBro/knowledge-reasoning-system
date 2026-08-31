import { QdrantClient } from "@qdrant/js-client-rest";

import type { QdrantClientPort } from "../contracts/qdrant-client-port.js";
import type { VectorStoreConfig } from "../types/vector-store-config.js";

/**
 * Build a Qdrant REST client from config.
 * API key is only set when present in config/env.
 */
export function createQdrantClient(
  config: VectorStoreConfig
): QdrantClientPort {

  const options: {
    url: string;
    apiKey?: string;
    timeout?: number;
    checkCompatibility?: boolean;
  } = {
    url: config.url,
    checkCompatibility: false
  };

  if (config.apiKey) {
    options.apiKey = config.apiKey;
  }

  if (config.timeoutMs !== undefined) {
    options.timeout = config.timeoutMs;
  }

  return new QdrantClient(options) as unknown as QdrantClientPort;

}
