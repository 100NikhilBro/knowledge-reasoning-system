
import type {
  EvidenceSet,
  ReasoningResult
} from "@knowledge/shared";

import {

  buildTrace

}

from "../utils/trace-builder.js";

import type {
  AnswerGenerator
} from "../contracts/answer-generator.js";



import {
  DefaultConfidenceEngine
} from "./confidence-engine.service.js";

import {
  DefaultCitationBuilder
} from "./citation-builder.service.js";




export class DefaultAnswerGenerator
implements AnswerGenerator {


    constructor(

    private readonly confidence =

      new DefaultConfidenceEngine(),

    private readonly citations =

      new DefaultCitationBuilder()

  ) {}

  async generate(

    evidence: EvidenceSet

  ): Promise<ReasoningResult> {

    const answer =

      evidence.evidence

        .map(item =>

          `${item.entity.type}: ${item.entity.label}`

        )

        .join("\n");

    const confidence =

  await this.confidence.calculate(

    evidence

  );

const citations =

  await this.citations.build(

    evidence

  );

return {

  answer,

  confidence,

  citations,

  trace: buildTrace(

    evidence

  )

};

  }

}