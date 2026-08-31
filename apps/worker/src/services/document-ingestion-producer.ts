import type { DiscoveredDocument } from "../types/discovered-document.js";

import type { DocumentDiscovery } from "../discovery/raw-document-discovery.js";

import type { IngestionQueue } from "../contracts/queue.js";

import type { Logger } from "../logging/logger.js";

const BLOCKING_JOB_STATES = new Set([
  "waiting",
  "active",
  "delayed",
  "prioritized",
  "waiting-children",
  "paused",
  "wait",
  "completed"
]);

export interface EnqueueDiscoveredResult {

  discovered: number;

  enqueued: number;

  skippedDuplicate: number;

  retriedFailed: number;

  failed: number;

  jobIds: string[];

}

/**
 * Converts discovered documents into ingest-document BullMQ jobs.
 * Separate from the worker processor.
 */
export class DocumentIngestionProducer {

  constructor(
    private readonly discovery: DocumentDiscovery,
    private readonly queue: IngestionQueue,
    private readonly logger?: Logger
  ) {}

  async enqueueDiscovered(): Promise<EnqueueDiscoveredResult> {

    const documents =
      await this.discovery.discover();

    const result: EnqueueDiscoveredResult = {
      discovered: documents.length,
      enqueued: 0,
      skippedDuplicate: 0,
      retriedFailed: 0,
      failed: 0,
      jobIds: []
    };

    for (const document of documents) {

      try {

        const outcome =
          await this.enqueueDocument(document);

        if (outcome === "enqueued") {
          result.enqueued += 1;
          result.jobIds.push(document.jobId);
          continue;
        }

        if (outcome === "retried") {
          result.enqueued += 1;
          result.retriedFailed += 1;
          result.jobIds.push(document.jobId);
          continue;
        }

        result.skippedDuplicate += 1;

      } catch (error) {

        result.failed += 1;

        this.logger?.error("enqueue.failed", {
          documentId: document.documentId,
          documentPath: document.absolutePath,
          jobId: document.jobId,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        });

      }

    }

    this.logger?.info("enqueue.completed", {
      discovered: result.discovered,
      enqueued: result.enqueued,
      skippedDuplicate: result.skippedDuplicate,
      retriedFailed: result.retriedFailed,
      failed: result.failed
    });

    return result;

  }

  private async enqueueDocument(
    document: DiscoveredDocument
  ): Promise<"enqueued" | "skipped" | "retried"> {

    let retried = false;

    if (this.queue.getJobState) {

      const state =
        await this.queue.getJobState(document.jobId);

      if (
        state !== null &&
        BLOCKING_JOB_STATES.has(state)
      ) {
        this.logger?.info("enqueue.skip_duplicate", {
          documentId: document.documentId,
          jobId: document.jobId,
          state
        });
        return "skipped";
      }

      if (state === "failed") {
        if (!this.queue.removeJob) {
          this.logger?.warn("enqueue.retry_blocked", {
            documentId: document.documentId,
            jobId: document.jobId,
            reason: "removeJob unavailable"
          });
          return "skipped";
        }

        await this.queue.removeJob(document.jobId);

        retried = true;

        this.logger?.info("enqueue.retry_after_failure", {
          documentId: document.documentId,
          jobId: document.jobId
        });
      }

    }

    try {

      await this.queue.addIngestDocumentJob(
        {
          documentPath: document.absolutePath,
          documentId: document.documentId,
          ...(document.source
            ? { source: document.source }
            : {})
        },
        {
          jobId: document.jobId
        }
      );

      this.logger?.info("enqueue.success", {
        documentId: document.documentId,
        documentPath: document.absolutePath,
        jobId: document.jobId,
        retried
      });

      return retried ? "retried" : "enqueued";

    } catch (error) {

      // BullMQ rejects duplicate job IDs — treat as skip, not failure.
      if (this.isDuplicateJobError(error)) {
        this.logger?.info("enqueue.skip_duplicate", {
          documentId: document.documentId,
          jobId: document.jobId,
          state: "exists"
        });
        return "skipped";
      }

      throw error;

    }

  }

  private isDuplicateJobError(
    error: unknown
  ): boolean {

    if (!(error instanceof Error)) {
      return false;
    }

    return /already exists|duplicate/i.test(
      error.message
    );

  }

}
