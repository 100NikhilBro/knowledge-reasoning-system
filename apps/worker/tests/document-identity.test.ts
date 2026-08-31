import { describe, expect, it } from "vitest";

import {
  buildDocumentId,
  buildDocumentIdentity,
  buildIngestJobId
} from "../src/utils/document-identity.js";

describe("document identity", () => {

  it("generates deterministic document and job identities", () => {

    const first =
      buildDocumentIdentity("python-peps/pep-484.md");

    const second =
      buildDocumentIdentity("python-peps/pep-484.md");

    expect(first).toEqual(second);
    expect(first.documentId).toBe("python-peps/pep-484.md");
    expect(first.jobId).toBe(
      "ingest__python-peps_pep-484.md"
    );

  });

  it("does not hardcode pep-484", () => {

    expect(
      buildDocumentId("guides/typing-intro.md")
    ).toBe("guides/typing-intro.md");

    expect(
      buildIngestJobId("guides/typing-intro.md")
    ).toBe("ingest__guides_typing-intro.md");

  });

});
