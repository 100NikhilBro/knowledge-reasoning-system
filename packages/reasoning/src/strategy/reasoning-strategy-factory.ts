import type {
  ReasoningPlan
} from "@knowledge/shared";

import {
  SingleHopStrategy
} from "./single-hop.strategy.js";

import {
  MultiHopStrategy
} from "./multi-hop.strategy.js";

import type {
  ReasoningStrategy
} from "./reasoning-strategy.js";

export class ReasoningStrategyFactory {

  static create(

    plan: ReasoningPlan

  ): ReasoningStrategy {

    switch (plan.strategy) {

      case "multi-hop":

        return new MultiHopStrategy();

      default:

        return new SingleHopStrategy();

    }

  }

}