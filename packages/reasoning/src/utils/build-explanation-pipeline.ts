import type {

  ExplanationPipeline

} from "../types/explanation-pipeline.js";

import type {

  AnswerExplanation

} from "../types/answer-explanation.js";

import type {

  ReasoningTrace

} from "../types/reasoning-trace.js";

export function buildExplanationPipeline(

  explanation: AnswerExplanation,

  trace: ReasoningTrace

): ExplanationPipeline {

  return {

    explanation,

    trace

  };

}