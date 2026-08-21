import type {
  MemoryState
} from "@knowledge/working-memory";

import type {
  SessionStateStore
} from "../contracts/session-state-store.js";

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

import {
  buildAnswerExplanation
} from "../utils/build-answer-explanation.js";

import {
  buildReasoningTrace
} from "../utils/build-reasoning-trace.js";

import {
  buildExplanationPipeline
} from "../utils/build-explanation-pipeline.js";


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
      new DefaultAnswerGenerator(),

    private readonly sessionStateStore?: SessionStateStore

  ) {}


  async reason(

    request: ReasoningRequest

  ): Promise<ReasoningResult> {

    /*
     * Load previous session history.
     *
     * For a new session, history starts empty.
     */

    let history: MemoryState[] = [];


    if (
      request.sessionId &&
      this.sessionStateStore
    ) {

      const previousState =
        await this.sessionStateStore.load(
          request.sessionId
        );


      if (previousState) {

        history = [
          ...previousState.history
        ];

      }


      /*
       * Persist the active state before
       * starting the reasoning pipeline.
       */

      await this.sessionStateStore.save(

        request.sessionId,

        {

          sessionId:
            request.sessionId,

          memory: {

            query:
              request.query,

            status:
              "active"

          },

          history

        }

      );

    }


    try {

      /*
       * Step 1
       * Collect evidence
       */

      const collected =
        await this.collector.collect(

          request

        );


      /*
       * Step 2
       * Build reasoning plan
       */

      const plan =
        await this.planner.plan(

          request

        );


      /*
       * Step 3
       * Perform graph reasoning
       */

      const expanded =
        await this.reasoner.reason(

          plan,

          collected

        );


      /*
       * Step 4
       * Synthesize evidence
       */

      const synthesized =
        await this.synthesizer.synthesize(

          expanded

        );


      /*
       * Step 5
       * Generate final answer
       */

      const result =
        await this.generator.generate(

          synthesized

        );


      /*
       * Internal explanation pipeline.
       *
       * The explanation and trace are currently
       * built internally and are not exposed
       * directly through ReasoningResult.
       */

      const explanation =
        buildAnswerExplanation(

          result.answer,

          synthesized.evidence

        );


      const trace =
        buildReasoningTrace(

          request.query,

          [],

          synthesized.evidence.length,

          0,

          result.confidence

        );


      buildExplanationPipeline(

        explanation,

        trace

      );


      /*
       * Persist completed session state.
       */

      if (
        request.sessionId &&
        this.sessionStateStore
      ) {

        const updatedHistory: MemoryState[] = [

          ...history,

          {

            query:
              request.query,

            status:
              "completed"

          }

        ];


        await this.sessionStateStore.save(

          request.sessionId,

          {

            sessionId:
              request.sessionId,

            memory: {

              query:
                request.query,

              status:
                "completed"

            },

            history:
              updatedHistory

          }

        );

      }


      return result;


    } catch (error) {

      /*
       * Persist failed session state.
       */

      if (
        request.sessionId &&
        this.sessionStateStore
      ) {

        const updatedHistory: MemoryState[] = [

          ...history,

          {

            query:
              request.query,

            status:
              "failed"

          }

        ];


        await this.sessionStateStore.save(

          request.sessionId,

          {

            sessionId:
              request.sessionId,

            memory: {

              query:
                request.query,

              status:
                "failed"

            },

            history:
              updatedHistory

          }

        );

      }


      throw error;

    }

  }

}