import type {
  ReasoningRequest,
  ReasoningPlan
} from "@knowledge/shared";

export interface ReasoningPlanner {

  plan(
    request: ReasoningRequest
  ): Promise<ReasoningPlan>;

}