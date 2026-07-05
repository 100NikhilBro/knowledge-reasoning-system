import type {
  Evidence
} from "@knowledge/shared";

import type {
  AnswerExplanation
} from "../types/answer-explanation.js";

export function buildAnswerExplanation(

  answer: string,

  evidence: Evidence[]

): AnswerExplanation {

  return {

    answer,

    reasoning: [

      `Evidence used: ${evidence.length}`,

      "Evidence ranked by confidence.",

      "Highest ranked evidence selected."

    ]

  };

}