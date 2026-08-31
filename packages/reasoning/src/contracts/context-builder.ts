import type {
  EvidenceSet
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import type {
  ReasoningContextConfig
} from "../types/reasoning-context-config.js";

export interface ContextBuilder {

  build(
    evidenceSet: EvidenceSet,
    config?: ReasoningContextConfig
  ): ReasoningContext;

}
