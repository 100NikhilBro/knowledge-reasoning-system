import { Worker } from "bullmq";

import type { ConnectionOptions, Processor } from "bullmq";

import type {
  IngestDocumentJobPayload,
  IngestDocumentJobResult
} from "../jobs/ingest-document.job.js";

import type { IngestionWorkerRuntime }
from "../contracts/queue.js";

export interface BullMQIngestionWorkerOptions {

  queueName: string;

  connection: ConnectionOptions;

  concurrency: number;

  processor: Processor<
    IngestDocumentJobPayload,
    IngestDocumentJobResult
  >;

}

export class BullMQIngestionWorker
  implements IngestionWorkerRuntime {

  private readonly worker: Worker<
    IngestDocumentJobPayload,
    IngestDocumentJobResult
  >;

  constructor(
    options: BullMQIngestionWorkerOptions
  ) {

    this.worker = new Worker<
      IngestDocumentJobPayload,
      IngestDocumentJobResult
    >(
      options.queueName,
      options.processor,
      {
        connection: options.connection,
        concurrency: options.concurrency
      }
    );

  }

  on(
    event: "ready" | "failed" | "completed" | "error",
    listener: (...args: never[]) => void
  ): void {

    this.worker.on(event, listener as never);

  }

  async close(): Promise<void> {

    await this.worker.close();

  }

}
