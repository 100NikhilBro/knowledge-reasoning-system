import { describe, expect, it } from "vitest";

import { finishReasoning } from "../src/utils/finish-reasoning.js";

describe("finish reasoning", () => {

  it("returns final reasoning result", () => {

    const result = finishReasoning(

      {

        stages: ["retrieve"]

      },

      {

        totalStages: 1,

        uniqueStages: 1

      }

    );

    expect(result.pipeline.stages).toEqual(

      ["retrieve"]

    );

    expect(

      result.statistics.totalStages

    ).toBe(1);

  });

});