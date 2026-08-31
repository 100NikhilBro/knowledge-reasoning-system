import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildAnswerExplanation
} from "../src/utils/build-answer-explanation.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

describe(

  "Answer Explanation",

  () => {

    it(

      "builds explanation",

      () => {

        const result =
          buildAnswerExplanation(

            "Python",

            []

          );

        expect(

          result.answer

        ).toBe(

          "Python"

        );

        expect(

          result.reasoning.length

        ).toBeGreaterThan(

          0

        );

      }

    );

    it(

      "grounds explanation in context provenance",

      () => {

        const context =
          new DefaultContextBuilder({
            maxEvidence: 5
          }).build({

            evidence: [

              {

                entity: {

                  id: "proposal:PEP-484",

                  type: "Proposal",

                  label: "Type Hints",

                  source: "pep-484.md",

                  confidence: 1,

                  properties: {}

                },

                score: 1,

                source: "graph"

              }

            ]

          });

        const result =
          buildAnswerExplanation(

            "Proposal: Type Hints",

            context

          );

        expect(
          result.reasoning
        ).toContain(
          "Grounded on proposal:PEP-484 from pep-484.md"
        );

      }

    );

  }

);
