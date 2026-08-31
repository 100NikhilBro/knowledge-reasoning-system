import { Queue } from "bullmq";

import type { ConnectionOptions } from "bullmq";

import {
  INGEST_DOCUMENT_JOB,
  type IngestDocumentJobPayload
} from "../jobs/ingest-document.job.js";

import type {
  IngestJobState,
  IngestionQueue
} from "../contracts/queue.js";

export interface BullMQIngestionQueueOptions {

  queueName: string;

  connection: ConnectionOptions;

  /**
   * Optional pre-built Queue for tests / DI.
   */
  queue?: Queue<IngestDocumentJobPayload>;

}

export class BullMQIngestionQueue
  implements IngestionQueue {

  private readonly queue: Queue<IngestDocumentJobPayload>;

  private readonly ownsQueue: boolean;

  constructor(
    options: BullMQIngestionQueueOptions
  ) {

    if (options.queue) {
      this.queue = options.queue;
      this.ownsQueue = false;
      return;
    }

    this.queue = new Queue<IngestDocumentJobPayload>(
      options.queueName,
      {
        connection: options.connection
      }
    );

    this.ownsQueue = true;

  }

  async addIngestDocumentJob(
    payload: IngestDocumentJobPayload,
    options: {
      jobId?: string;
      attempts?: number;
    } = {}
  ): Promise<{ id: string }> {

    const job = await this.queue.add(
      INGEST_DOCUMENT_JOB,
      payload,
      {
        jobId: options.jobId,
        attempts: options.attempts ?? 3,
        backoff: {
          type: "exponential",
          delay: 2000
        },
        // Keep completed jobs so deterministic IDs can dedupe re-enqueue.
        removeOnComplete: false,
        // Keep failed jobs so getJobState("failed") works; producer removes before retry.
        removeOnFail: false
      }
    );

    return {
      id: String(job.id)
    };

  }

  async getJobState(
    jobId: string
  ): Promise<IngestJobState | null> {

    const job =
      await this.queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state =
      await job.getState();

    return state as IngestJobState;

  }

  async removeJob(
    jobId: string
  ): Promise<boolean> {

    const job =
      await this.queue.getJob(jobId);

    if (!job) {
      return false;
    }

    await job.remove();
    return true;

  }

  async close(): Promise<void> {

    if (this.ownsQueue) {
      await this.queue.close();
    }

  }

}
