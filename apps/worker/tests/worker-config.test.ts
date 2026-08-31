import { describe, expect, it } from "vitest";

import {
  INGEST_DOCUMENT_JOB
} from "../src/jobs/ingest-document.job.js";

import { resolveWorkerConfig }
from "../src/config/resolve-worker-config.js";

import { resolveKnowledgePathsConfig }
from "../src/config/resolve-knowledge-paths.js";

describe("ingestion job contract", () => {

  it("exports a stable ingest-document job name", () => {

    expect(INGEST_DOCUMENT_JOB).toBe("ingest-document");

  });

});

describe("resolveWorkerConfig", () => {

  it("defaults to local Redis from docker-compose", () => {

    expect(resolveWorkerConfig({})).toEqual({
      redisUrl: "redis://localhost:6379",
      queueName: "knowledge-ingestion",
      concurrency: 1,
      initializeGraphSchema: true
    });

  });

  it("reads worker env overrides", () => {

    expect(
      resolveWorkerConfig({
        REDIS_URL: "redis://cache:6379",
        INGESTION_QUEUE_NAME: "docs",
        INGESTION_CONCURRENCY: "2",
        INGESTION_INITIALIZE_GRAPH_SCHEMA: "false"
      })
    ).toEqual({
      redisUrl: "redis://cache:6379",
      queueName: "docs",
      concurrency: 2,
      initializeGraphSchema: false
    });

  });

});

describe("resolveKnowledgePathsConfig", () => {

  it("resolves configurable raw/processed paths relative to baseDir", () => {

    const baseDir =
      process.platform === "win32"
        ? "C:\\repo"
        : "/repo";

    const config =
      resolveKnowledgePathsConfig(
        {
          KNOWLEDGE_RAW_DIR: "knowledge_state/raw",
          KNOWLEDGE_PROCESSED_DIR: "knowledge_state/processed",
          INGESTION_SUPPORTED_EXTENSIONS: ".md,.markdown"
        },
        baseDir
      );

    expect(config.rawDir.replace(/\\/g, "/"))
      .toMatch(/\/repo\/knowledge_state\/raw$/);

    expect(config.processedDir.replace(/\\/g, "/"))
      .toMatch(/\/repo\/knowledge_state\/processed$/);

    expect(config.supportedExtensions).toEqual([
      ".md",
      ".markdown"
    ]);

  });

  it("defaults relative paths to the monorepo root", () => {

    const config =
      resolveKnowledgePathsConfig({});

    expect(config.rawDir.replace(/\\/g, "/"))
      .toMatch(/\/knowledge-reasoning-system\/knowledge_state\/raw$/);

    expect(config.processedDir.replace(/\\/g, "/"))
      .toMatch(/\/knowledge-reasoning-system\/knowledge_state\/processed$/);

  });

});
