import type {
  ReasoningResult
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

export interface AnswerGenerator {

  generate(
    context: ReasoningContext
  ): Promise<ReasoningResult>;

}
