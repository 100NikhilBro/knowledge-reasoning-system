import { describe, expect, it } from "vitest";

import { runReasoning } from "../src/utils/run-reasoning.js";

describe("Run Reasoning", () => {
  it("returns reasoning result", () => {
    const result = runReasoning({
      query: "What is GraphRAG?"
    });

    expect(result.answer.length).toBeGreaterThan(0);
  });
});