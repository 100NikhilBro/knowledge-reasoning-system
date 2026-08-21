import {
  describe,
  expect,
  it
} from "vitest";

import {
  DefaultReasoningEngine
} from "../src/services/reasoning-engine.service.js";

import type {
  SessionState
} from "@knowledge/working-memory";

import type {
  SessionStateStore
} from "../src/contracts/session-state-store.js";

import type {
  ReasoningRequest,
  ReasoningPlan
} from "@knowledge/shared";

import type {
  ReasoningPlanner
} from "../src/contracts/reasoning-planner.js";


class FakeSessionStateStore
implements SessionStateStore {

  private readonly states =
    new Map<string, SessionState>();


  async save(
    sessionId: string,
    state: SessionState
  ): Promise<void> {

    this.states.set(
      sessionId,
      state
    );

  }


  async load(
    sessionId: string
  ): Promise<SessionState | null> {

    return (
      this.states.get(
        sessionId
      ) ?? null
    );

  }


  async clear(
    sessionId: string
  ): Promise<void> {

    this.states.delete(
      sessionId
    );

  }

}


class FailingReasoningPlanner
implements ReasoningPlanner {

  async plan(
    _request: ReasoningRequest
  ): Promise<ReasoningPlan> {

    throw new Error(
      "Planning failed"
    );

  }

}


describe(

  "Reasoning Engine",

  () => {

    it(

      "should instantiate",

      () => {

        const engine =
          new DefaultReasoningEngine();

        expect(
          engine
        ).toBeDefined();

      }

    );


    it(

      "should execute pipeline",

      async () => {

        const engine =
          new DefaultReasoningEngine();

        await expect(

          engine.reason({

            query:
              "What is PEP-484?",

            topK:
              5

          })

        ).resolves.toBeDefined();

      }

    );


    it(

      "should persist completed session state",

      async () => {

        const store =
          new FakeSessionStateStore();

        const engine =
          new DefaultReasoningEngine(

            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            store

          );


        await engine.reason({

          query:
            "What is PEP-484?",

          topK:
            5,

          sessionId:
            "session-completed"

        });


        const state =
          await store.load(
            "session-completed"
          );


        expect(
          state
        ).toEqual({

          sessionId:
            "session-completed",

          memory: {

            query:
              "What is PEP-484?",

            status:
              "completed"

          },

          history: [

            {

              query:
                "What is PEP-484?",

              status:
                "completed"

            }

          ]

        });

      }

    );


    it(

      "should persist failed session state",

      async () => {

        const store =
          new FakeSessionStateStore();

        const planner =
          new FailingReasoningPlanner();

        const engine =
          new DefaultReasoningEngine(

            undefined,
            planner,
            undefined,
            undefined,
            undefined,
            store

          );


        await expect(

          engine.reason({

            query:
              "What is PEP-484?",

            sessionId:
              "session-failed"

          })

        ).rejects.toThrow(
          "Planning failed"
        );


        const state =
          await store.load(
            "session-failed"
          );


        expect(
          state
        ).toEqual({

          sessionId:
            "session-failed",

          memory: {

            query:
              "What is PEP-484?",

            status:
              "failed"

          },

          history: [

            {

              query:
                "What is PEP-484?",

              status:
                "failed"

            }

          ]

        });

      }

    );


    it(

      "should preserve session history across requests",

      async () => {

        const store =
          new FakeSessionStateStore();

        const engine =
          new DefaultReasoningEngine(

            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            store

          );


        await engine.reason({

          query:
            "What is PEP-484?",

          topK:
            5,

          sessionId:
            "session-history"

        });


        await engine.reason({

          query:
            "What is typing?",

          topK:
            5,

          sessionId:
            "session-history"

        });


        const state =
          await store.load(
            "session-history"
          );


        expect(
          state
        ).toEqual({

          sessionId:
            "session-history",

          memory: {

            query:
              "What is typing?",

            status:
              "completed"

          },

          history: [

            {

              query:
                "What is PEP-484?",

              status:
                "completed"

            },

            {

              query:
                "What is typing?",

              status:
                "completed"

            }

          ]

        });

      }

    );

  }

);