import { describe, expect, it } from "vitest";

import { calculateScore }
from "../src/ranking/score.js";

describe("calculateScore", () => {

  it("should prioritize Proposal", () => {

    expect(

      calculateScore({

        id: "1",

        type: "Proposal",

        label: "",

        source: "",

        confidence: 1,

        properties: {}

      })

    ).toBe(6);

  });

  it("should prioritize Feature", () => {

    expect(

      calculateScore({

        id: "1",

        type: "Feature",

        label: "",

        source: "",

        confidence: 1,

        properties: {}

      })

    ).toBe(5);

  });

});