export interface WorkerConfig {

  redisUrl: string;

  queueName: string;

  concurrency: number;

  /**
   * When true, initialize Neo4j schema before each ingest.
   */
  initializeGraphSchema: boolean;

}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  field: string
): number {

  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }

  return parsed;

}

function parseBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {

  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  throw new Error(
    `Expected boolean for env value, received "${value}"`
  );

}

/**
 * Resolve worker/queue configuration from environment.
 *
 * REDIS_URL=redis://localhost:6379
 * INGESTION_QUEUE_NAME=knowledge-ingestion
 * INGESTION_CONCURRENCY=1
 * INGESTION_INITIALIZE_GRAPH_SCHEMA=true
 */
export function resolveWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): WorkerConfig {

  return {
    redisUrl:
      env.REDIS_URL?.trim() || "redis://localhost:6379",
    queueName:
      env.INGESTION_QUEUE_NAME?.trim() || "knowledge-ingestion",
    concurrency: parsePositiveInt(
      env.INGESTION_CONCURRENCY,
      1,
      "INGESTION_CONCURRENCY"
    ),
    initializeGraphSchema: parseBoolean(
      env.INGESTION_INITIALIZE_GRAPH_SCHEMA,
      true
    )
  };

}
