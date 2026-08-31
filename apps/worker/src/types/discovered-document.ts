/**
 * Supported input extensions for multi-document discovery.
 *
 * PARSER LIMITATION:
 * The current DocumentParserPort is wired to PEPParser, which expects
 * PEP-style markdown (metadata headers + section titles). Discovery is
 * format-agnostic at the file layer (.md), but parse/extract still depend
 * on that PEP markdown shape until additional parsers exist.
 */
export const DEFAULT_SUPPORTED_EXTENSIONS = [
  ".md"
] as const;

export interface DiscoveredDocument {

  /**
   * Absolute filesystem path to the raw document.
   */
  absolutePath: string;

  /**
   * Path relative to the raw root, using forward slashes.
   * Example: "python-peps/pep-484.md"
   */
  relativePath: string;

  /**
   * Stable document identity derived from relativePath.
   */
  documentId: string;

  /**
   * Deterministic BullMQ job id for this document.
   */
  jobId: string;

  /**
   * Optional source label (top-level folder under raw, when present).
   */
  source?: string;

}
