import { describe, expect, it } from "vitest";

import { buildMemoryKey } from "../src/utils/build-memory-key.js";

describe("buildMemoryKey", () => {

  it("builds a namespaced memory key", () => {

    expect(
      buildMemoryKey({
        namespace: "session-123",
        key: "reasoning-state"
      })
    ).toBe(
      "session-123:reasoning-state"
    );

  });

});