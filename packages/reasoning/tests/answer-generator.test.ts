import {
  describe,
  expect,
  it
} from "vitest";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

describe(

  "Answer Generator",

  () => {

    it(

      "should generate answer from evidence",

      async () => {

        const generator =
          new DefaultAnswerGenerator();

        const result =

          await generator.generate({

            evidence: [

              {

                entity: {

                  id: "1",

                  type: "Proposal",

                  label: "PEP-484",

                  source: "pep.md",

                  confidence: 1,

                  properties: {}

                },

                score: 1,

                source: "graph"

              }

            ]

          });

        expect(
          result.answer
        ).toContain("PEP-484");

        expect(
          result.confidence
        ).toBe(1);

      }

    );

  }

);

it(

  "should prefer comparison answer",

  async () => {

    const generator =

      new DefaultAnswerGenerator();

    const result =

      await generator.generate(

  {

    evidence: [],

    comparison:

      "Common: Typing"

  }

);

    expect(

      result.answer

    ).toContain(

      "Common"

    );

  }

);