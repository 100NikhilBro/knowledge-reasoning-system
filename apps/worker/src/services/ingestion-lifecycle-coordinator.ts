import type {
  IngestDocumentJobPayload,
  IngestDocumentJobResult
} from "../jobs/ingest-document.job.js";

import type { DocumentIngestionService }
from "./document-ingestion.service.js";

import type { DocumentIngestionProducer }
from "./document-ingestion-producer.js";

import type { EnqueueDiscoveredResult }
from "./document-ingestion-producer.js";

import type {
  IngestJobState,
  IngestionQueue
} from "../contracts/queue.js";

import type { Logger } from "../logging/logger.js";

export interface ClaimableIngestionQueue
  extends IngestionQueue {

  claimWaitingJobs(): Array<{
    id: string;
    payload: IngestDocumentJobPayload;
  }>;

  setJobState(
    jobId: string,
    state: Extract<IngestJobState, "completed" | "failed" | "active">
  ): void;

}

export interface IngestionLifecycleCycleResult {

  enqueue: EnqueueDiscoveredResult;

  completed: IngestDocumentJobResult[];

  failures: Array<{
    jobId: string;
    documentPath: string;
    error: string;
  }>;

}

/**
 * Reliability helper: discover → enqueue → process waiting jobs once.
 *
 * Uses injectable queue/service dependencies so tests do not need live
 * Redis, Neo4j, or Qdrant. Live infrastructure verification remains a
 * deployment step.
 */
export class IngestionLifecycleCoordinator {

  constructor(
    private readonly producer: DocumentIngestionProducer,
    private readonly queue: ClaimableIngestionQueue,
    private readonly service: DocumentIngestionService,
    private readonly logger?: Logger
  ) {}

  async runCycle(): Promise<IngestionLifecycleCycleResult> {

    const enqueue =
      await this.producer.enqueueDiscovered();

    const waiting =
      this.queue.claimWaitingJobs();

    const completed: IngestDocumentJobResult[] = [];
    const failures: IngestionLifecycleCycleResult["failures"] = [];

    for (const job of waiting) {

      this.queue.setJobState(job.id, "active");

      try {

        const result =
          await this.service.ingest(job.payload);

        this.queue.setJobState(job.id, "completed");
        completed.push(result);

        this.logger?.info("lifecycle.job.completed", {
          jobId: job.id,
          documentId: result.documentId,
          documentPath: result.documentPath
        });

      } catch (error) {

        this.queue.setJobState(job.id, "failed");

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        failures.push({
          jobId: job.id,
          documentPath: job.payload.documentPath,
          error: message
        });

        this.logger?.error("lifecycle.job.failed", {
          jobId: job.id,
          documentPath: job.payload.documentPath,
          error: message
        });

        // Keep explicit failure semantics — do not convert to success.
      }

    }

    this.logger?.info("lifecycle.cycle.completed", {
      enqueued: enqueue.enqueued,
      completed: completed.length,
      failures: failures.length
    });

    return {
      enqueue,
      completed,
      failures
    };

  }

}
