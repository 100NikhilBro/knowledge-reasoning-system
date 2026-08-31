import type {
  Evidence
} from "@knowledge/shared";

import type {
  AnswerExplanation
} from "../types/answer-explanation.js";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

/**
 * Build explanation metadata grounded only in supplied context/evidence.
 * Does not invent claims beyond counts and provenance references.
 */
export function buildAnswerExplanation(

  answer: string,

  evidenceOrContext: Evidence[] | ReasoningContext

): AnswerExplanation {

  const evidence =
    Array.isArray(evidenceOrContext)
      ? evidenceOrContext
      : evidenceOrContext.evidence;

  const reasoning: string[] = [

    `Evidence used: ${evidence.length}`

  ];

  for (const item of evidence) {

    reasoning.push(
      `Grounded on ${item.entity.id} from ${item.entity.source}`
    );

  }

  if (evidence.length > 0) {

    reasoning.push(
      "Evidence ranked by score; highest-ranked retained under context budget."
    );

  }

  return {

    answer,

    reasoning

  };

}
