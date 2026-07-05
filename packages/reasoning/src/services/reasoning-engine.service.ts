import type {
  ReasoningRequest,
  ReasoningResult
} from "@knowledge/shared";

import type {
  ReasoningEngine
} from "../contracts/reasoning-engine.js";

import {
  DefaultEvidenceCollector
} from "./evidence-collector.service.js";

import {
  DefaultReasoningPlanner
} from "./reasoning-planner.service.js";

import {
  DefaultGraphReasoner
} from "./graph-reasoner.service.js";

import {
  DefaultEvidenceSynthesizer
} from "./evidence-synthesizer.service.js";

import {
  DefaultAnswerGenerator
} from "./answer-generator.service.js";

export class DefaultReasoningEngine
implements ReasoningEngine {

  constructor(

    private readonly collector =
      new DefaultEvidenceCollector(),

    private readonly planner =
      new DefaultReasoningPlanner(),

    private readonly reasoner =
      new DefaultGraphReasoner(),

    private readonly synthesizer =
      new DefaultEvidenceSynthesizer(),

    private readonly generator =
      new DefaultAnswerGenerator()

  ) {}

  async reason(

    request: ReasoningRequest

  ): Promise<ReasoningResult> {

   const collected =

await this.collector.collect(
    request
);

const plan =

await this.planner.plan(
    request
);

const expanded =

await this.reasoner.reason(

    plan,

    collected

);
const synthesized =

await this.synthesizer.synthesize(

    expanded

);

return this.generator.generate(

    synthesized

);

  }

}