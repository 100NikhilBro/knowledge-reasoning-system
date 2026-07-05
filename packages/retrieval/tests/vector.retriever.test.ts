import { describe, expect, it } from "vitest";

import { DummyVectorRetriever }
from "../src/vector/vector.retriever.js";

describe("DummyVectorRetriever", () => {

  it("should return empty array", async () => {

    const retriever =
      new DummyVectorRetriever();

    const results =
      await retriever.retrieve({

        query: "pep-484"

      });

    expect(results).toEqual([]);

  });

});