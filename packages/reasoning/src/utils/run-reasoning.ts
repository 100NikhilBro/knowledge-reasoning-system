// import type { ReasoningRequest } from "../types/reasoning-request.js";
// import type { ReasoningResult } from "../types/reasoning-result.js";

// import { orchestrateReasoning } from "./orchestrate-reasoning.js";

// export function runReasoning(
//   request: ReasoningRequest
// ): ReasoningResult {
//  return orchestrateReasoning();
// }


import type { ReasoningRequest }
  from "../types/reasoning-request.js";

import type { ReasoningResult }
  from "../types/reasoning-result.js";

import { orchestrateReasoning }
  from "./orchestrate-reasoning.js";

export function runReasoning(
  request: ReasoningRequest
): ReasoningResult {

  const result =
    orchestrateReasoning();

  return {

    ...result,

    sessionId:
      request.sessionId

  };

}