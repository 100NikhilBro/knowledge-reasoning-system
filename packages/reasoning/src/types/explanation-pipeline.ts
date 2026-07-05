import type {

  AnswerExplanation

} from "./answer-explanation.js";

import type {

  ReasoningTrace

} from "./reasoning-trace.js";

export interface ExplanationPipeline {

  explanation: AnswerExplanation;

  trace: ReasoningTrace;

}