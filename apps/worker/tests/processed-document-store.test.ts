import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  access,
  rm
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { FilesystemProcessedDocumentStore }
from "../src/processed/filesystem-processed-document-store.js";

import {
  DocumentIngestionService
} from "../src/services/document-ingestion.service.js";

describe("FilesystemProcessedDocumentStore", () => {

  const tempDirs: string[] = [];

  afterEach(async () => {

    await Promise.all(
      tempDirs.splice(0).map(async dir => {
        await rm(dir, {
          recursive: true,
          force: true
        });
      })
    );

  });

  it("moves a document into processed and is idempotent", async () => {

    const root =
      await mkdtemp(
        path.join(os.tmpdir(), "knowledge-processed-")
      );

    tempDirs.push(root);

    const rawDir =
      path.join(root, "raw");

    const processedDir =
      path.join(root, "processed");

    const relativePath =
      "python-peps/pep-demo.md";

    const sourcePath =
      path.join(rawDir, "python-peps", "pep-demo.md");

    await mkdir(path.dirname(sourcePath), {
      recursive: true
    });

    await writeFile(sourcePath, "content");

    const store =
      new FilesystemProcessedDocumentStore({
        rawDir,
        processedDir
      });

    await store.markProcessed({
      documentPath: sourcePath,
      documentId: relativePath,
      relativePath
    });

    await expect(
      access(sourcePath)
    ).rejects.toBeTruthy();

    const processedPath =
      path.join(processedDir, "python-peps", "pep-demo.md");

    await expect(
      readFile(processedPath, "utf8")
    ).resolves.toBe("content");

    // Idempotent when already processed and source gone
    await store.markProcessed({
      documentPath: sourcePath,
      documentId: relativePath,
      relativePath
    });

    await expect(
      store.isProcessed(relativePath)
    ).resolves.toBe(true);

  });

});

describe("DocumentIngestionService processed marking", () => {

  it("marks processed only after successful ingestion", async () => {

    const markProcessed = vi.fn(async () => undefined);

    const service =
      new DocumentIngestionService({
        files: {
          exists: vi.fn(async () => true),
          read: vi.fn(async () => "content")
        },
        parser: {
          parse: vi.fn(() => ({
            document: {
              metadata: {},
              sections: [],
              raw: "content",
              warnings: []
            },
            errors: []
          }))
        },
        entityExtractor: {
          extract: vi.fn(() => [])
        },
        relationshipExtractor: {
          extract: vi.fn(() => [])
        },
        graph: {
          ingest: vi.fn(async () => undefined)
        },
        indexer: {
          index: vi.fn(async () => ({
            indexed: 0,
            entityIds: []
          }))
        },
        processedStore: {
          markProcessed,
          isProcessed: vi.fn(async () => false)
        },
        initializeGraphSchema: false
      });

    await service.ingest({
      documentPath: "/tmp/raw/doc.md",
      documentId: "doc.md"
    });

    expect(markProcessed).toHaveBeenCalledWith({
      documentPath: "/tmp/raw/doc.md",
      documentId: "doc.md"
    });

  });

  it("does not mark processed when a downstream stage fails", async () => {

    const markProcessed = vi.fn(async () => undefined);

    const service =
      new DocumentIngestionService({
        files: {
          exists: vi.fn(async () => true),
          read: vi.fn(async () => "content")
        },
        parser: {
          parse: vi.fn(() => ({
            document: {
              metadata: {},
              sections: [],
              raw: "content",
              warnings: []
            },
            errors: []
          }))
        },
        entityExtractor: {
          extract: vi.fn(() => [])
        },
        relationshipExtractor: {
          extract: vi.fn(() => [])
        },
        graph: {
          ingest: vi.fn(async () => {
            throw new Error("graph failed");
          })
        },
        indexer: {
          index: vi.fn()
        },
        processedStore: {
          markProcessed,
          isProcessed: vi.fn(async () => false)
        },
        initializeGraphSchema: false
      });

    await expect(
      service.ingest({
        documentPath: "/tmp/raw/doc.md"
      })
    ).rejects.toThrow("graph failed");

    expect(markProcessed).not.toHaveBeenCalled();

  });

});
