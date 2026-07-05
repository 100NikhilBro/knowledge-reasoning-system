import type {
  ReasoningRequest,
  ReasoningResult
} from "@knowledge/shared";

export interface ReasoningEngine {

  reason(
    request: ReasoningRequest
  ): Promise<ReasoningResult>;

}