import { describe, expect, it, vi } from "vitest";

import type { Job } from "bullmq";

import { createIngestionProcessor }
from "../src/processors/ingestion.processor.js";

import type { DocumentIngestionService }
from "../src/services/document-ingestion.service.js";

import type {
  IngestDocumentJobPayload,
  IngestDocumentJobResult
} from "../src/jobs/ingest-document.job.js";

describe("createIngestionProcessor", () => {

  it("delegates successful jobs to the ingestion service", async () => {

    const result: IngestDocumentJobResult = {
      documentPath: "pep-484.md",
      documentId: "pep-484",
      entityCount: 1,
      relationshipCount: 0,
      indexedCount: 1,
      entityIds: ["proposal:PEP-484"]
    };

    const service = {
      ingest: vi.fn(async () => result)
    } as unknown as DocumentIngestionService;

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const processor =
      createIngestionProcessor(service, logger);

    const job = {
      id: "job-1",
      name: "ingest-document",
      attemptsMade: 0,
      data: {
        documentPath: "pep-484.md",
        documentId: "pep-484"
      } satisfies IngestDocumentJobPayload
    } as Job<IngestDocumentJobPayload, IngestDocumentJobResult>;

    await expect(processor(job)).resolves.toEqual(result);

    expect(service.ingest).toHaveBeenCalledWith(job.data);
    expect(logger.info).toHaveBeenCalled();

  });

  it("re-throws failures so BullMQ can retry / mark failed", async () => {

    const service = {
      ingest: vi.fn(async () => {
        throw new Error("vector index failed");
      })
    } as unknown as DocumentIngestionService;

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const processor =
      createIngestionProcessor(service, logger);

    const job = {
      id: "job-2",
      name: "ingest-document",
      attemptsMade: 1,
      data: {
        documentPath: "pep-484.md"
      }
    } as Job<IngestDocumentJobPayload, IngestDocumentJobResult>;

    await expect(processor(job))
      .rejects.toThrow("vector index failed");

    expect(logger.error).toHaveBeenCalledWith(
      "ingestion.job.failed",
      expect.objectContaining({
        jobId: "job-2",
        documentPath: "pep-484.md",
        error: "vector index failed"
      })
    );

  });

});
