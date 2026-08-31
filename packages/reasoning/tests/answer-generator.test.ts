import {
  describe,
  expect,
  it
} from "vitest";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

describe(

  "Answer Generator",

  () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 20
      });

    it(

      "should generate answer from evidence",

      async () => {

        const generator =
          new DefaultAnswerGenerator();

        const context =
          builder.build({

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

        const result =
          await generator.generate(
            context
          );

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

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 20
      });

    const result =
      await generator.generate(

        builder.build({

          evidence: [],

          comparison:
            "Common: Typing"

        })

      );

    expect(

      result.answer

    ).toContain(

      "Common"

    );

  }

);
