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

import type {
  AnswerGenerator
} from "../contracts/answer-generator.js";

import {
  DefaultContextBuilder
} from "./context-builder.service.js";

import type {
  ContextBuilder
} from "../contracts/context-builder.js";

import type {
  AnswerVerifier
} from "../contracts/answer-verifier.js";

import {
  DefaultAnswerVerifier
} from "./answer-verifier.service.js";

import {
  buildAnswerExplanation
} from "../utils/build-answer-explanation.js";

import {
  buildReasoningTrace
} from "../utils/build-reasoning-trace.js";

import {
  buildExplanationPipeline
} from "../utils/build-explanation-pipeline.js";

import {
  filterCompatibleEvidence
} from "../utils/query-evidence-compatibility.js";

import {
  selectAnswerEvidence
} from "../utils/select-answer-evidence.js";

import {
  understandQuery
} from "../utils/query-understanding.js";

import {
  executeAnalytical
} from "../utils/execute-analytical.js";

import {
  executeSummarization
} from "../utils/execute-summarization.js";


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

    private readonly generator: AnswerGenerator =
      new DefaultAnswerGenerator(),

    private readonly sessionStateStore?: SessionStateStore,

    private readonly contextBuilder: ContextBuilder =
      new DefaultContextBuilder(),

    private readonly answerVerifier: AnswerVerifier =
      new DefaultAnswerVerifier()

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
       * Step 4b
       * Fail closed when retrieved evidence is not query-compatible
       * (near-match / wrong-topic similarity must not ground answers).
       */

      const compatibleEvidence =
        filterCompatibleEvidence(

          request.query,

          synthesized.evidence

        );

      /*
       * Step 4c
       * Query-focused answer evidence selection.
       * Topic-compatible neighbors may remain after Step 4b; only
       * Tier 1–3 answer-relevant evidence may enter generation context.
       */
      const understanding =
        understandQuery(request.query);

      const answerEvidence =
        selectAnswerEvidence(
          understanding,
          compatibleEvidence
        );

      const groundedEvidenceSet = {
        evidence:
          answerEvidence,
        ...(synthesized.comparison !== undefined
          ? { comparison: synthesized.comparison }
          : {})
      };


      /*
       * Step 5
       * Build grounded context from verified evidence
       */

      const context =
        this.contextBuilder.build(

          groundedEvidenceSet

        );

      context.query =
        request.query;

      context.understanding =
        understanding;

      /*
       * Step 5b (P6)
       * Deterministic analytical execution over grounded evidence.
       */
      if (
        context.understanding.intent === "ANALYTICAL" &&
        context.understanding.analytical
      ) {
        context.analyticalResult =
          executeAnalytical(
            context.understanding.analytical,
            context.evidence
          );
      }

      /*
       * Step 5c (P7)
       * Deterministic summarization / cross-document synthesis.
       */
      if (
        context.understanding.intent === "SUMMARIZATION" &&
        context.understanding.summarization
      ) {
        context.summarizationResult =
          executeSummarization(
            context.understanding.summarization,
            context.evidence,
            {
              query: request.query,
              includeAnalyticalCount:
                /\bhow many\b|\bcount\b/i.test(request.query)
            }
          );
      }


      /*
       * Step 6
       * Generate final answer from grounded context
       */

      const result =
        await this.generator.generate(

          context

        );


      /*
       * Explanation metadata produced by the
       * existing builders, exposed on the
       * shared ReasoningResult contract.
       */

      const explanation =
        buildAnswerExplanation(

          result.answer,

          context

        );


      const explanationTrace =
        buildReasoningTrace(

          request.query,

          [],

          context.evidence.length,

          0,

          result.confidence

        );


      buildExplanationPipeline(

        explanation,

        explanationTrace

      );


      /*
       * Step 7
       * Final citation / answer verification against grounded context.
       * Internal verification report is not exposed on the public result.
       */

      const verification =
        this.answerVerifier.verify({

          result,

          context,

          explanation

        });

      const exposedResult: ReasoningResult =
        verification.result;


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


      return exposedResult;


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