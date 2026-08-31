/**
 * Stable BullMQ job name for document ingestion.
 */
export const INGEST_DOCUMENT_JOB = "ingest-document" as const;

export type IngestDocumentJobName =
  typeof INGEST_DOCUMENT_JOB;

/**
 * Payload for ingesting a single knowledge document from the filesystem.
 */
export interface IngestDocumentJobPayload {

  /**
   * Absolute or workspace-relative path to the raw document.
   */
  documentPath: string;

  /**
   * Optional stable document identifier for logs/results.
   * Defaults to the basename of documentPath.
   */
  documentId?: string;

  /**
   * Optional source label preserved in indexing metadata.
   */
  source?: string;

}

export interface IngestDocumentJobResult {

  documentPath: string;

  documentId: string;

  entityCount: number;

  relationshipCount: number;

  indexedCount: number;

  entityIds: string[];

}
