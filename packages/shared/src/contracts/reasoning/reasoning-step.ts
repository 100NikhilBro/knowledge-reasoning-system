import type { Evidence }
from "./evidence.js";

export interface ReasoningStep {

  description: string;

  evidence: Evidence[];

}