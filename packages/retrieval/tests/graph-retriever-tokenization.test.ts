import {
  describe,
  expect,
  it
} from "vitest";

import {
  Neo4jGraphRetriever
} from "../src/graph/graph.retriever.js";

/**
 * Exercise private tokenize behavior via findCandidates filter semantics
 * by subclassing and exposing tokenize for regression coverage without Neo4j.
 */
class TokenProbeRetriever extends Neo4jGraphRetriever {
  public tokensFor(query: string): string[] {
    return (this as unknown as {
      tokenize(value: string): string[];
      normalize(value: string): string;
    }).tokenize(
      (this as unknown as {
        normalize(value: string): string;
      }).normalize(query)
    );
  }
}

describe("Neo4jGraphRetriever query tokenization", () => {
  it("drops interrogative stopwords that previously false-matched labels", () => {
    const retriever =
      new TokenProbeRetriever();

    const tokens =
      retriever.tokensFor("What is PEP-8?");

    expect(tokens).toContain("pep-8");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("what");
  });

  it("keeps coded topic tokens for exact lookups", () => {
    const retriever =
      new TokenProbeRetriever();

    const tokens =
      retriever.tokensFor("What is PEP-484?");

    expect(tokens).toContain("pep-484");
  });
});
