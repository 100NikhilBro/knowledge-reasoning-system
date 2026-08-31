import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";

import { buildGraphId } from "@knowledge/shared";

import { resolveDocumentSource } from "../utils/resolve-document-source.js";

/**
 * Extracts a PythonVersion only when structured metadata provides a version.
 *
 * Expected parser metadata key (from "Python-Version: ..." headers):
 * metadata.python_version
 *
 * LIMITATION: body-text-only version mentions are not extracted without
 * structured metadata — avoids fabricating versions from ambiguous prose.
 */
export class PythonVersionRule implements ExtractionRule {

  readonly name = "PythonVersionRule";

  extract(
    document: ParsedDocument
  ): KnowledgeEntity | null {

    const version =
      document.metadata.python_version?.trim();

    if (!version) {
      return null;
    }

    // Require at least one digit so empty/placeholder values are rejected.
    if (!/\d/.test(version)) {
      return null;
    }

    const slug =
      version
        .toLowerCase()
        .replace(/\s+/g, "-");

    return {

      id: buildGraphId(
        "PythonVersion",
        slug
      ),

      type: "PythonVersion",

      label: version,

      source: resolveDocumentSource(document),

      confidence: 1.0,

      properties: {

        version

      }

    };

  }

}
