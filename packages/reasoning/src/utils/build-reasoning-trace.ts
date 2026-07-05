import type {

  ReasoningTrace

} from "../types/reasoning-trace.js";

export function buildReasoningTrace(

  query: string,

  traversal: string[],

  evidenceCount: number,

  conflicts: number,

  confidence: number

): ReasoningTrace {

  return {

    query,

    traversal,

    evidenceCount,

    conflicts,

    confidence

  };

}