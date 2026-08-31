import {
  access,
  mkdir,
  rename,
  copyFile,
  unlink
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

import { IngestionError } from "../errors/ingestion-error.js";

import type { Logger } from "../logging/logger.js";

export interface ProcessedDocumentStore {

  /**
   * Mark a successfully ingested raw document as processed.
   * Must be idempotent.
   */
  markProcessed(input: {
    documentPath: string;
    documentId: string;
    relativePath?: string;
  }): Promise<void>;

  isProcessed(relativePath: string): Promise<boolean>;

}

export interface FilesystemProcessedDocumentStoreOptions {

  rawDir: string;

  processedDir: string;

  logger?: Logger;

}

/**
 * Moves documents from raw → processed, preserving relative layout.
 */
export class FilesystemProcessedDocumentStore
  implements ProcessedDocumentStore {

  private readonly rawDir: string;

  private readonly processedDir: string;

  private readonly logger?: Logger;

  constructor(
    options: FilesystemProcessedDocumentStoreOptions
  ) {

    this.rawDir = options.rawDir;
    this.processedDir = options.processedDir;
    this.logger = options.logger;

  }

  async isProcessed(
    relativePath: string
  ): Promise<boolean> {

    const target =
      this.toProcessedPath(relativePath);

    try {
      await access(target, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }

  }

  async markProcessed(input: {
    documentPath: string;
    documentId: string;
    relativePath?: string;
  }): Promise<void> {

    const relativePath =
      input.relativePath
      ?? this.toRelativeRawPath(input.documentPath);

    const sourcePath =
      path.normalize(input.documentPath);

    const targetPath =
      this.toProcessedPath(relativePath);

    const sourceExists =
      await this.exists(sourcePath);

    const targetExists =
      await this.exists(targetPath);

    if (!sourceExists && targetExists) {
      this.logger?.info("processed.already_marked", {
        documentId: input.documentId,
        relativePath,
        processedPath: targetPath
      });
      return;
    }

    if (!sourceExists && !targetExists) {
      throw new IngestionError(
        "PROCESSED_SOURCE_MISSING",
        `Cannot mark processed; source missing: ${sourcePath}`
      );
    }

    await mkdir(path.dirname(targetPath), {
      recursive: true
    });

    if (targetExists) {
      // Idempotent replace of an existing processed copy.
      await unlink(targetPath);
    }

    try {

      await rename(sourcePath, targetPath);

    } catch {

      // Cross-device fallback
      await copyFile(sourcePath, targetPath);
      await unlink(sourcePath);

    }

    this.logger?.info("processed.marked", {
      documentId: input.documentId,
      relativePath,
      processedPath: targetPath
    });

  }

  private toRelativeRawPath(
    documentPath: string
  ): string {

    const relative =
      path.relative(
        this.rawDir,
        path.normalize(documentPath)
      );

    if (
      !relative ||
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    ) {
      throw new IngestionError(
        "INVALID_DOCUMENT_PATH",
        `Document path is outside rawDir: ${documentPath}`
      );
    }

    return relative.split(path.sep).join("/");

  }

  private toProcessedPath(
    relativePath: string
  ): string {

    return path.join(
      this.processedDir,
      ...relativePath.split("/")
    );

  }

  private async exists(
    target: string
  ): Promise<boolean> {

    try {
      await access(target, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }

  }

}
