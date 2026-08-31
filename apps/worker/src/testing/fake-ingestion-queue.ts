import type {
  IngestDocumentJobPayload
} from "../jobs/ingest-document.job.js";

import type {
  IngestJobState,
  IngestionQueue
} from "../contracts/queue.js";

import type { ClaimableIngestionQueue }
from "../services/ingestion-lifecycle-coordinator.js";

interface StoredJob {

  id: string;

  payload: IngestDocumentJobPayload;

  state: IngestJobState;

}

/**
 * In-memory queue for reliability tests (no Redis).
 */
export class FakeIngestionQueue
  implements IngestionQueue, ClaimableIngestionQueue {

  private readonly jobs =
    new Map<string, StoredJob>();

  async addIngestDocumentJob(
    payload: IngestDocumentJobPayload,
    options: {
      jobId?: string;
      attempts?: number;
    } = {}
  ): Promise<{ id: string }> {

    const id =
      options.jobId
      ?? `job-${this.jobs.size + 1}`;

    if (this.jobs.has(id)) {
      throw new Error(`Job ${id} already exists`);
    }

    this.jobs.set(id, {
      id,
      payload,
      state: "waiting"
    });

    return { id };

  }

  async getJobState(
    jobId: string
  ): Promise<IngestJobState | null> {

    return this.jobs.get(jobId)?.state ?? null;

  }

  async removeJob(
    jobId: string
  ): Promise<boolean> {

    return this.jobs.delete(jobId);

  }

  claimWaitingJobs(): Array<{
    id: string;
    payload: IngestDocumentJobPayload;
  }> {

    const waiting: Array<{
      id: string;
      payload: IngestDocumentJobPayload;
    }> = [];

    for (const job of this.jobs.values()) {
      if (job.state === "waiting") {
        waiting.push({
          id: job.id,
          payload: job.payload
        });
      }
    }

    return waiting;
  }

  setJobState(
    jobId: string,
    state: Extract<IngestJobState, "completed" | "failed" | "active">
  ): void {

    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Unknown job ${jobId}`);
    }

    job.state = state;

  }

  getJob(
    jobId: string
  ): StoredJob | undefined {

    return this.jobs.get(jobId);

  }

  async close(): Promise<void> {
    // no-op
  }

}
