import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { DiscoveredDocument } from "../types/discovered-document.js";

import {
  buildDocumentIdentity,
  toPosixPath
} from "../utils/document-identity.js";

import type { Logger } from "../logging/logger.js";

export interface DocumentDiscovery {

  discover(): Promise<DiscoveredDocument[]>;

}

export interface RawDocumentDiscoveryOptions {

  rawDir: string;

  processedDir: string;

  supportedExtensions: string[];

  /**
   * When true (default), skip documents that already exist under processedDir.
   */
  skipAlreadyProcessed?: boolean;

  logger?: Logger;

}

/**
 * Discovers supported documents under knowledge_state/raw (recursive).
 * Kept separate from the BullMQ worker processor.
 */
export class RawDocumentDiscovery
  implements DocumentDiscovery {

  private readonly rawDir: string;

  private readonly processedDir: string;

  private readonly supportedExtensions: Set<string>;

  private readonly skipAlreadyProcessed: boolean;

  private readonly logger?: Logger;

  constructor(
    options: RawDocumentDiscoveryOptions
  ) {

    this.rawDir = options.rawDir;
    this.processedDir = options.processedDir;
    this.supportedExtensions = new Set(
      options.supportedExtensions.map(
        extension => extension.toLowerCase()
      )
    );
    this.skipAlreadyProcessed =
      options.skipAlreadyProcessed ?? true;
    this.logger = options.logger;

  }

  async discover(): Promise<DiscoveredDocument[]> {

    const rootStats =
      await this.safeStat(this.rawDir);

    if (!rootStats) {
      this.logger?.warn("discovery.raw_missing", {
        rawDir: this.rawDir
      });
      return [];
    }

    if (!rootStats.isDirectory()) {
      this.logger?.warn("discovery.raw_not_directory", {
        rawDir: this.rawDir
      });
      return [];
    }

    const discovered: DiscoveredDocument[] = [];
    let skippedUnsupported = 0;
    let skippedProcessed = 0;

    await this.walk(
      this.rawDir,
      async filePath => {

        const extension =
          path.extname(filePath).toLowerCase();

        if (!this.supportedExtensions.has(extension)) {
          skippedUnsupported += 1;
          this.logger?.info("discovery.skip_unsupported", {
            path: filePath,
            extension
          });
          return;
        }

        const relativePath =
          toPosixPath(
            path.relative(this.rawDir, filePath)
          );

        if (
          this.skipAlreadyProcessed &&
          await this.isAlreadyProcessed(relativePath)
        ) {
          skippedProcessed += 1;
          this.logger?.info("discovery.skip_processed", {
            relativePath,
            processedDir: this.processedDir
          });
          return;
        }

        const identity =
          buildDocumentIdentity(relativePath);

        const topLevel =
          relativePath.split("/")[0];

        const source =
          topLevel && topLevel !== relativePath
            ? topLevel
            : undefined;

        discovered.push({
          absolutePath: filePath,
          relativePath,
          documentId: identity.documentId,
          jobId: identity.jobId,
          ...(source ? { source } : {})
        });

      }
    );

    discovered.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath)
    );

    this.logger?.info("discovery.completed", {
      rawDir: this.rawDir,
      discovered: discovered.length,
      skippedUnsupported,
      skippedProcessed
    });

    return discovered;

  }

  private async isAlreadyProcessed(
    relativePath: string
  ): Promise<boolean> {

    const processedPath =
      path.join(
        this.processedDir,
        ...relativePath.split("/")
      );

    const stats =
      await this.safeStat(processedPath);

    return Boolean(stats?.isFile());

  }

  private async walk(
    directory: string,
    onFile: (filePath: string) => Promise<void>
  ): Promise<void> {

    let entries;

    try {
      entries = await readdir(directory, {
        withFileTypes: true
      });
    } catch (error) {
      this.logger?.warn("discovery.read_failed", {
        directory,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      });
      return;
    }

    for (const entry of entries) {

      const fullPath =
        path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await this.walk(fullPath, onFile);
        continue;
      }

      if (entry.isFile()) {
        await onFile(fullPath);
      }

    }

  }

  private async safeStat(
    target: string
  ) {

    try {
      return await stat(target);
    } catch {
      return null;
    }

  }

}
