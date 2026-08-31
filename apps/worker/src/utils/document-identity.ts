import path from "node:path";

/**
 * Normalize path separators to forward slashes for stable identities.
 */
export function toPosixPath(
  value: string
): string {

  return value.split(path.sep).join("/");

}

/**
 * Build a deterministic document id from a raw-root-relative path.
 */
export function buildDocumentId(
  relativePath: string
): string {

  return toPosixPath(relativePath)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

}

/**
 * Build a deterministic BullMQ job id.
 * Uses a safe character set (alphanumeric, underscore, dot, hyphen).
 */
export function buildIngestJobId(
  relativePath: string
): string {

  const normalized =
    buildDocumentId(relativePath)
      .replace(/[^a-zA-Z0-9._-]+/g, "_");

  return `ingest__${normalized}`;

}

export function buildDocumentIdentity(
  relativePath: string
): {
  documentId: string;
  jobId: string;
} {

  const documentId =
    buildDocumentId(relativePath);

  return {
    documentId,
    jobId: buildIngestJobId(relativePath)
  };

}
