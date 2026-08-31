import type { Job } from "bullmq";

import type {
  IngestDocumentJobPayload,
  IngestDocumentJobResult
} from "../jobs/ingest-document.job.js";

import type { DocumentIngestionService }
from "../services/document-ingestion.service.js";

import type { Logger } from "../logging/logger.js";

/**
 * BullMQ processor adapter around DocumentIngestionService.
 * Re-throws failures so BullMQ can retry / mark failed correctly.
 */
export function createIngestionProcessor(
  service: DocumentIngestionService,
  logger?: Logger
) {

  return async (
    job: Job<IngestDocumentJobPayload, IngestDocumentJobResult>
  ): Promise<IngestDocumentJobResult> => {

    const documentPath =
      job.data.documentPath;

    const documentId =
      job.data.documentId ?? documentPath;

    logger?.info("ingestion.job.started", {
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      documentPath,
      documentId
    });

    try {

      const result =
        await service.ingest(job.data);

      logger?.info("ingestion.job.completed", {
        jobId: job.id,
        documentPath: result.documentPath,
        documentId: result.documentId,
        entityCount: result.entityCount,
        relationshipCount: result.relationshipCount,
        indexedCount: result.indexedCount
      });

      return result;

    } catch (error) {

      logger?.error("ingestion.job.failed", {
        jobId: job.id,
        documentPath,
        documentId,
        attemptsMade: job.attemptsMade,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        code:
          error instanceof Error &&
          "code" in error
            ? String(
              (error as { code?: unknown }).code
            )
            : undefined
      });

      throw error;

    }

  };

}
