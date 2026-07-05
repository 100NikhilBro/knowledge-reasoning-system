import { describe, expect, it } from "vitest";

import {

  orchestrateReasoning

} from "../src/utils/orchestrate-reasoning.js";

describe("orchestrate reasoning", () => {

  it("creates final reasoning result", () => {

    const result =
      orchestrateReasoning();

    expect(result.pipeline).toBeDefined();

    expect(result.statistics).toBeDefined();

  });

});