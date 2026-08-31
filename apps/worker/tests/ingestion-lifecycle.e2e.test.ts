import {
  mkdtemp,
  mkdir,
  writeFile,
  access,
  rm
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { RawDocumentDiscovery }
from "../src/discovery/raw-document-discovery.js";

import { DocumentIngestionProducer }
from "../src/services/document-ingestion-producer.js";

import { DocumentIngestionService }
from "../src/services/document-ingestion.service.js";

import { IngestionLifecycleCoordinator }
from "../src/services/ingestion-lifecycle-coordinator.js";

import { FilesystemProcessedDocumentStore }
from "../src/processed/filesystem-processed-document-store.js";

import { FilesystemDocumentFile }
from "../src/io/filesystem-document-file.js";

import { FakeIngestionQueue }
from "../src/testing/fake-ingestion-queue.js";

import { buildDocumentIdentity }
from "../src/utils/document-identity.js";

import type { ParsedDocument } from "@knowledge/parser";

/**
 * End-to-end ingestion reliability coverage using filesystem + in-memory queue fakes.
 *
 * Live Redis / Neo4j / Qdrant remain a deployment verification step; this suite is
 * infrastructure-independent and exercises the full discover → enqueue → ingest
 * → processed lifecycle with injected dependencies.
 */

describe("ingestion lifecycle reliability", () => {

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

  async function createWorkspace() {

    const root =
      await mkdtemp(
        path.join(os.tmpdir(), "ingestion-lifecycle-")
      );

    tempDirs.push(root);

    const rawDir =
      path.join(root, "raw");

    const processedDir =
      path.join(root, "processed");

    await mkdir(
      path.join(rawDir, "python-peps"),
      { recursive: true }
    );

    await mkdir(processedDir, {
      recursive: true
    });

    const relativePath =
      "python-peps/sample-pep.md";

    const documentPath =
      path.join(rawDir, "python-peps", "sample-pep.md");

    await writeFile(
      documentPath,
      [
        "PEP: 999",
        "Title: Sample",
        "Author: Test Author",
        "Status: Accepted",
        "",
        "Abstract",
        "========",
        "",
        "This PEP introduces type hints."
      ].join("\n"),
      "utf8"
    );

    return {
      root,
      rawDir,
      processedDir,
      relativePath,
      documentPath,
      identity: buildDocumentIdentity(relativePath)
    };

  }

  function createParsedDocument(): ParsedDocument {

    return {
      metadata: {
        pep: "999",
        title: "Sample",
        author: "Test Author",
        status: "Accepted"
      },
      sections: [
        {
          title: "Abstract",
          level: 1,
          content: "This PEP introduces type hints."
        }
      ],
      raw: "content",
      warnings: []
    };

  }

  function createPipeline(options: {
    rawDir: string;
    processedDir: string;
    failAt?: "parse" | "graph" | "index";
    order?: string[];
  }) {

    const order = options.order ?? [];

    const queue =
      new FakeIngestionQueue();

    const discovery =
      new RawDocumentDiscovery({
        rawDir: options.rawDir,
        processedDir: options.processedDir,
        supportedExtensions: [".md"]
      });

    const producer =
      new DocumentIngestionProducer(
        discovery,
        queue
      );

    const processedStore =
      new FilesystemProcessedDocumentStore({
        rawDir: options.rawDir,
        processedDir: options.processedDir
      });

    const entities = [
      {
        id: "proposal:PEP-999",
        type: "Proposal",
        label: "Sample",
        source: "pep-999.md",
        confidence: 1,
        properties: {}
      }
    ];

    const relationships = [
      {
        from: "proposal:PEP-999",
        to: "decision:accepted",
        type: "RESULTS_IN",
        confidence: 1
      }
    ];

    const service =
      new DocumentIngestionService({
        files: new FilesystemDocumentFile(),
        parser: {
          parse: vi.fn(() => {
            order.push("parse");
            if (options.failAt === "parse") {
              throw new Error("parse failed");
            }
            return {
              document: createParsedDocument(),
              errors: []
            };
          })
        },
        entityExtractor: {
          extract: vi.fn(() => {
            order.push("extract-entities");
            return entities;
          })
        },
        relationshipExtractor: {
          extract: vi.fn(() => {
            order.push("extract-relationships");
            return relationships;
          })
        },
        graph: {
          initialize: vi.fn(async () => {
            order.push("graph-initialize");
          }),
          ingest: vi.fn(async () => {
            order.push("graph-ingest");
            if (options.failAt === "graph") {
              throw new Error("graph failed");
            }
          })
        },
        indexer: {
          index: vi.fn(async () => {
            order.push("vector-index");
            if (options.failAt === "index") {
              throw new Error("vector index failed");
            }
            return {
              indexed: entities.length,
              entityIds: entities.map(entity => entity.id)
            };
          })
        },
        processedStore: {
          markProcessed: async input => {
            order.push("mark-processed");
            await processedStore.markProcessed(input);
          },
          isProcessed: relativePath =>
            processedStore.isProcessed(relativePath)
        },
        initializeGraphSchema: true
      });

    const coordinator =
      new IngestionLifecycleCoordinator(
        producer,
        queue,
        service
      );

    return {
      queue,
      discovery,
      producer,
      service,
      coordinator,
      processedStore,
      order,
      entities
    };

  }

  it("runs a complete successful ingestion lifecycle", async () => {

    const workspace =
      await createWorkspace();

    const pipeline =
      createPipeline(workspace);

    const first =
      await pipeline.coordinator.runCycle();

    expect(first.enqueue.discovered).toBe(1);
    expect(first.enqueue.enqueued).toBe(1);
    expect(first.completed).toHaveLength(1);
    expect(first.failures).toHaveLength(0);

    expect(first.completed[0]).toMatchObject({
      documentId: workspace.identity.documentId,
      entityCount: 1,
      relationshipCount: 1,
      indexedCount: 1
    });

    await expect(
      access(workspace.documentPath, fsConstants.F_OK)
    ).rejects.toBeTruthy();

    await expect(
      pipeline.processedStore.isProcessed(
        workspace.relativePath
      )
    ).resolves.toBe(true);

    expect(
      pipeline.queue.getJob(workspace.identity.jobId)?.state
    ).toBe("completed");

  });

  it("processes stages in the required order with graph before vector indexing", async () => {

    const workspace =
      await createWorkspace();

    const pipeline =
      createPipeline(workspace);

    await pipeline.coordinator.runCycle();

    expect(pipeline.order).toEqual([
      "parse",
      "extract-entities",
      "extract-relationships",
      "graph-initialize",
      "graph-ingest",
      "vector-index",
      "mark-processed"
    ]);

    const graphIndex =
      pipeline.order.indexOf("graph-ingest");

    const vectorIndex =
      pipeline.order.indexOf("vector-index");

    const processedIndex =
      pipeline.order.indexOf("mark-processed");

    expect(graphIndex).toBeLessThan(vectorIndex);
    expect(vectorIndex).toBeLessThan(processedIndex);

  });

  it("propagates graph failure and does not mark processed", async () => {

    const workspace =
      await createWorkspace();

    const pipeline =
      createPipeline({
        ...workspace,
        failAt: "graph"
      });

    const result =
      await pipeline.coordinator.runCycle();

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBe("graph failed");
    expect(result.completed).toHaveLength(0);

    expect(pipeline.order).toEqual([
      "parse",
      "extract-entities",
      "extract-relationships",
      "graph-initialize",
      "graph-ingest"
    ]);

    await expect(
      access(workspace.documentPath, fsConstants.F_OK)
    ).resolves.toBeUndefined();

    await expect(
      pipeline.processedStore.isProcessed(
        workspace.relativePath
      )
    ).resolves.toBe(false);

    expect(
      pipeline.queue.getJob(workspace.identity.jobId)?.state
    ).toBe("failed");

  });

  it("propagates vector indexing failure and does not mark processed", async () => {

    const workspace =
      await createWorkspace();

    const pipeline =
      createPipeline({
        ...workspace,
        failAt: "index"
      });

    const result =
      await pipeline.coordinator.runCycle();

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBe(
      "vector index failed"
    );

    expect(pipeline.order).toContain("graph-ingest");
    expect(pipeline.order).toContain("vector-index");
    expect(pipeline.order).not.toContain("mark-processed");

    await expect(
      pipeline.processedStore.isProcessed(
        workspace.relativePath
      )
    ).resolves.toBe(false);

  });

  it("creates processed file only after success", async () => {

    const workspace =
      await createWorkspace();

    const pipeline =
      createPipeline(workspace);

    await pipeline.coordinator.runCycle();

    const processedPath =
      path.join(
        workspace.processedDir,
        "python-peps",
        "sample-pep.md"
      );

    await expect(
      access(processedPath, fsConstants.F_OK)
    ).resolves.toBeUndefined();

  });

  it("does not enqueue duplicates on repeated discovery", async () => {

    const workspace =
      await createWorkspace();

    const pipeline =
      createPipeline(workspace);

    const first =
      await pipeline.producer.enqueueDiscovered();

    const second =
      await pipeline.producer.enqueueDiscovered();

    expect(first.enqueued).toBe(1);
    expect(second.enqueued).toBe(0);
    expect(second.skippedDuplicate).toBe(1);

    expect(first.jobIds[0])
      .toBe(workspace.identity.jobId);

  });

  it("keeps deterministic job/document identity across discovery runs", async () => {

    const workspace =
      await createWorkspace();

    const discovery =
      new RawDocumentDiscovery({
        rawDir: workspace.rawDir,
        processedDir: workspace.processedDir,
        supportedExtensions: [".md"]
      });

    const first =
      await discovery.discover();

    const second =
      await discovery.discover();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);

    expect(first[0].documentId)
      .toBe(second[0].documentId);

    expect(first[0].jobId)
      .toBe(second[0].jobId);

    expect(first[0].jobId)
      .toBe(workspace.identity.jobId);

  });

  it("retries a previously failed document and can succeed", async () => {

    const workspace =
      await createWorkspace();

    const order: string[] = [];

    let failGraphOnce = true;

    const queue =
      new FakeIngestionQueue();

    const discovery =
      new RawDocumentDiscovery({
        rawDir: workspace.rawDir,
        processedDir: workspace.processedDir,
        supportedExtensions: [".md"]
      });

    const producer =
      new DocumentIngestionProducer(
        discovery,
        queue
      );

    const processedStore =
      new FilesystemProcessedDocumentStore({
        rawDir: workspace.rawDir,
        processedDir: workspace.processedDir
      });

    const service =
      new DocumentIngestionService({
        files: new FilesystemDocumentFile(),
        parser: {
          parse: () => ({
            document: createParsedDocument(),
            errors: []
          })
        },
        entityExtractor: {
          extract: () => [
            {
              id: "proposal:PEP-999",
              type: "Proposal",
              label: "Sample",
              source: "pep-999.md",
              confidence: 1,
              properties: {}
            }
          ]
        },
        relationshipExtractor: {
          extract: () => []
        },
        graph: {
          ingest: async () => {
            order.push("graph");
            if (failGraphOnce) {
              failGraphOnce = false;
              throw new Error("transient graph failure");
            }
          }
        },
        indexer: {
          index: async () => {
            order.push("index");
            return {
              indexed: 1,
              entityIds: ["proposal:PEP-999"]
            };
          }
        },
        processedStore,
        initializeGraphSchema: false
      });

    const coordinator =
      new IngestionLifecycleCoordinator(
        producer,
        queue,
        service
      );

    const failedCycle =
      await coordinator.runCycle();

    expect(failedCycle.failures).toHaveLength(1);
    expect(
      queue.getJob(workspace.identity.jobId)?.state
    ).toBe("failed");

    await expect(
      processedStore.isProcessed(workspace.relativePath)
    ).resolves.toBe(false);

    const retryCycle =
      await coordinator.runCycle();

    expect(retryCycle.enqueue.retriedFailed).toBe(1);
    expect(retryCycle.enqueue.enqueued).toBe(1);
    expect(retryCycle.completed).toHaveLength(1);
    expect(retryCycle.failures).toHaveLength(0);

    await expect(
      processedStore.isProcessed(workspace.relativePath)
    ).resolves.toBe(true);

    expect(order).toEqual([
      "graph",
      "graph",
      "index"
    ]);

  });

  it("safely ignores already processed documents on later discovery", async () => {

    const workspace =
      await createWorkspace();

    const pipeline =
      createPipeline(workspace);

    await pipeline.coordinator.runCycle();

    const later =
      await pipeline.coordinator.runCycle();

    expect(later.enqueue.discovered).toBe(0);
    expect(later.enqueue.enqueued).toBe(0);
    expect(later.completed).toHaveLength(0);
    expect(later.failures).toHaveLength(0);

  });

  it("handles missing and empty input directories safely", async () => {

    const root =
      await mkdtemp(
        path.join(os.tmpdir(), "ingestion-empty-")
      );

    tempDirs.push(root);

    const missingDiscovery =
      new RawDocumentDiscovery({
        rawDir: path.join(root, "missing-raw"),
        processedDir: path.join(root, "processed"),
        supportedExtensions: [".md"]
      });

    await expect(missingDiscovery.discover())
      .resolves.toEqual([]);

    const emptyRaw =
      path.join(root, "empty-raw");

    await mkdir(emptyRaw, { recursive: true });

    const emptyDiscovery =
      new RawDocumentDiscovery({
        rawDir: emptyRaw,
        processedDir: path.join(root, "processed"),
        supportedExtensions: [".md"]
      });

    const queue =
      new FakeIngestionQueue();

    const producer =
      new DocumentIngestionProducer(
        emptyDiscovery,
        queue
      );

    const result =
      await producer.enqueueDiscovered();

    expect(result).toMatchObject({
      discovered: 0,
      enqueued: 0,
      skippedDuplicate: 0,
      failed: 0
    });

  });

  it("supports dependency injection for lifecycle components", async () => {

    const queue =
      new FakeIngestionQueue();

    const discovery = {
      discover: vi.fn(async () => [])
    };

    const producer =
      new DocumentIngestionProducer(
        discovery,
        queue
      );

    const service = {
      ingest: vi.fn()
    } as unknown as DocumentIngestionService;

    const coordinator =
      new IngestionLifecycleCoordinator(
        producer,
        queue,
        service
      );

    const result =
      await coordinator.runCycle();

    expect(discovery.discover).toHaveBeenCalledOnce();
    expect(service.ingest).not.toHaveBeenCalled();
    expect(result.enqueue.discovered).toBe(0);
    expect(result.completed).toEqual([]);

  });

});
