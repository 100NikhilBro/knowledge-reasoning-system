import type { Citation }
from "./citation.js";

import type { ReasoningTrace }
from "./reasoning-trace.js";

import type { AnswerExplanation }
from "./answer-explanation.js";

export interface ReasoningResult {

  answer: string;

  confidence: number;

  citations: Citation[];

  trace: ReasoningTrace;

  comparison?: string;

  explanation?: AnswerExplanation;

}
