import type { ReasoningRequest } from "../types/reasoning-request.js";
import type { ReasoningResult } from "../types/reasoning-result.js";

import { orchestrateReasoning } from "./orchestrate-reasoning.js";

export function runReasoning(
  request: ReasoningRequest
): ReasoningResult {
 return orchestrateReasoning();
}