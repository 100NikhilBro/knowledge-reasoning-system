import { describe, expect, it, vi } from "vitest";

import { DocumentIngestionProducer }
from "../src/services/document-ingestion-producer.js";

import type { DiscoveredDocument }
from "../src/types/discovered-document.js";

function doc(
  relativePath: string
): DiscoveredDocument {

  return {
    absolutePath: `/tmp/raw/${relativePath}`,
    relativePath,
    documentId: relativePath,
    jobId: `ingest__${relativePath.replace(/\//g, "_")}`,
    source: relativePath.split("/")[0]
  };

}

describe("DocumentIngestionProducer", () => {

  it("enqueues discovered documents with deterministic job ids", async () => {

    const documents = [
      doc("python-peps/pep-484.md"),
      doc("python-peps/pep-8.md")
    ];

    const discovery = {
      discover: vi.fn(async () => documents)
    };

    const queue = {
      addIngestDocumentJob: vi.fn(async (_payload, options) => ({
        id: String(options?.jobId)
      })),
      getJobState: vi.fn(async () => null),
      close: vi.fn(async () => undefined)
    };

    const producer =
      new DocumentIngestionProducer(
        discovery,
        queue
      );

    const result =
      await producer.enqueueDiscovered();

    expect(result.discovered).toBe(2);
    expect(result.enqueued).toBe(2);
    expect(result.skippedDuplicate).toBe(0);
    expect(result.jobIds).toEqual([
      "ingest__python-peps_pep-484.md",
      "ingest__python-peps_pep-8.md"
    ]);

    expect(queue.addIngestDocumentJob)
      .toHaveBeenCalledWith(
        {
          documentPath: documents[0].absolutePath,
          documentId: documents[0].documentId,
          source: "python-peps"
        },
        {
          jobId: documents[0].jobId
        }
      );

  });

  it("avoids duplicate enqueueing for pending/completed jobs", async () => {

    const documents = [
      doc("python-peps/pep-484.md"),
      doc("notes/draft.md")
    ];

    const discovery = {
      discover: vi.fn(async () => documents)
    };

    const queue = {
      addIngestDocumentJob: vi.fn(async (_payload, options) => ({
        id: String(options?.jobId)
      })),
      getJobState: vi.fn(async (jobId: string) =>
        jobId === documents[0].jobId
          ? "completed"
          : null
      ),
      close: vi.fn(async () => undefined)
    };

    const producer =
      new DocumentIngestionProducer(
        discovery,
        queue
      );

    const result =
      await producer.enqueueDiscovered();

    expect(result.enqueued).toBe(1);
    expect(result.skippedDuplicate).toBe(1);
    expect(queue.addIngestDocumentJob)
      .toHaveBeenCalledTimes(1);

  });

  it("retries failed jobs by removing and re-enqueueing", async () => {

    const documents = [
      doc("python-peps/pep-484.md")
    ];

    const discovery = {
      discover: vi.fn(async () => documents)
    };

    const queue = {
      addIngestDocumentJob: vi.fn(async (_payload, options) => ({
        id: String(options?.jobId)
      })),
      getJobState: vi.fn(async () => "failed" as const),
      removeJob: vi.fn(async () => true),
      close: vi.fn(async () => undefined)
    };

    const producer =
      new DocumentIngestionProducer(
        discovery,
        queue
      );

    const result =
      await producer.enqueueDiscovered();

    expect(queue.removeJob).toHaveBeenCalledWith(
      documents[0].jobId
    );

    expect(queue.addIngestDocumentJob)
      .toHaveBeenCalledOnce();

    expect(result.enqueued).toBe(1);
    expect(result.retriedFailed).toBe(1);
    expect(result.skippedDuplicate).toBe(0);

  });

  it("supports injected mocked dependencies", async () => {

    const discovery = {
      discover: vi.fn(async () => [])
    };

    const queue = {
      addIngestDocumentJob: vi.fn(),
      getJobState: vi.fn(),
      close: vi.fn(async () => undefined)
    };

    const producer =
      new DocumentIngestionProducer(
        discovery,
        queue
      );

    const result =
      await producer.enqueueDiscovered();

    expect(result).toEqual({
      discovered: 0,
      enqueued: 0,
      skippedDuplicate: 0,
      retriedFailed: 0,
      failed: 0,
      jobIds: []
    });

    expect(queue.addIngestDocumentJob)
      .not.toHaveBeenCalled();

  });

});
