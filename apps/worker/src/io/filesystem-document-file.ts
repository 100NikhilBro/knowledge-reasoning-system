import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import type { DocumentFilePort } from "../contracts/ingestion-ports.js";

import { IngestionError } from "../errors/ingestion-error.js";

export class FilesystemDocumentFile
  implements DocumentFilePort {

  async exists(
    documentPath: string
  ): Promise<boolean> {

    try {

      await access(documentPath, fsConstants.F_OK);
      return true;

    } catch {

      return false;

    }

  }

  async read(
    documentPath: string
  ): Promise<string> {

    try {

      return await readFile(documentPath, "utf8");

    } catch (error) {

      throw new IngestionError(
        "DOCUMENT_READ_FAILED",
        error instanceof Error
          ? error.message
          : `Failed to read document at ${documentPath}`,
        { cause: error instanceof Error ? error : undefined }
      );

    }

  }

}
