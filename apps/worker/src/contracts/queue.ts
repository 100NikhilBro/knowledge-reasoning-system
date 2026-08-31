import type {
  IngestDocumentJobPayload,
  IngestDocumentJobResult
} from "../jobs/ingest-document.job.js";

export type IngestJobState =
  | "waiting"
  | "active"
  | "delayed"
  | "prioritized"
  | "waiting-children"
  | "paused"
  | "repeat"
  | "wait"
  | "completed"
  | "failed"
  | "unknown";

/**
 * Queue port for enqueueing ingestion jobs (BullMQ or fakes).
 */
export interface IngestionQueue {

  addIngestDocumentJob(
    payload: IngestDocumentJobPayload,
    options?: {
      jobId?: string;
      attempts?: number;
    }
  ): Promise<{ id: string }>;

  /**
   * Optional lookup used for duplicate suppression.
   */
  getJobState?(
    jobId: string
  ): Promise<IngestJobState | null>;

  /**
   * Optional removal used to clear failed jobs before deterministic retry.
   */
  removeJob?(
    jobId: string
  ): Promise<boolean>;

  close(): Promise<void>;

}

/**
 * Worker runtime port (BullMQ Worker or fakes).
 */
export interface IngestionWorkerRuntime {

  close(): Promise<void>;

}

export type IngestionJobProcessor = (
  payload: IngestDocumentJobPayload,
  context: {
    jobId?: string;
    attemptsMade?: number;
  }
) => Promise<IngestDocumentJobResult>;
