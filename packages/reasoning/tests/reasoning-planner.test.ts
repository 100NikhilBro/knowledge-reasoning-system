import {

  describe,
  expect,
  it

} from "vitest";

import {
  DefaultReasoningPlanner
} from "../src/services/reasoning-planner.service.js";

describe(

  "Reasoning Planner",

  () => {

    const planner =
      new DefaultReasoningPlanner();

    it(

      "should detect single hop",

      async () => {

        const plan =
          await planner.plan({

            query:
              "Who proposed PEP-484?"

          });

        expect(
          plan.strategy
        ).toBe("single-hop");

        expect(
          plan.focusRelationships
        ).toEqual(["PROPOSED_BY"]);

      }

    );

    it(

      "should detect comparison",

      async () => {

        const plan =
          await planner.plan({

            query:
              "Compare PEP-484 and PEP-544"

          });

        expect(
          plan.strategy
        ).toBe("comparison");

      }

    );

    it(

      "should detect explanation",

      async () => {

        const plan =
          await planner.plan({

            query:
              "Why was PEP-484 introduced?"

          });

        expect(
          plan.strategy
        ).toBe("explanation");

      }

    );

    it(

      "should detect multi hop when and/both has no relationship focus",

      async () => {

        const plan =
          await planner.plan({

            query:
              "How do PEP-484 and its related entities connect through multiple hops?"

          });

        expect(
          plan.strategy
        ).toBe("multi-hop");

        expect(
          plan.focusRelationships
        ).toBeUndefined();

      }

    );

    it(

      "keeps compound focused relationship questions on single-hop",

      async () => {

        const plan =
          await planner.plan({

            query:
              "Who proposed PEP-484, what feature did it introduce, what concern did it address, and what decision resulted from it?"

          });

        expect(plan.strategy).toBe("single-hop");

        expect(plan.focusRelationships).toEqual([
          "PROPOSED_BY",
          "ADDRESSES",
          "INTRODUCES",
          "RESULTS_IN"
        ]);

      }

    );

    it(

      "plans RESULTS_IN and IMPLEMENTED_IN without multi-hop dump for decision+version questions",

      async () => {

        const plan =
          await planner.plan({

            query:
              "What decision resulted from PEP-484 and which Python version implemented it?"

          });

        expect(plan.strategy).toBe("single-hop");

        expect(plan.focusRelationships).toEqual([
          "RESULTS_IN",
          "IMPLEMENTED_IN"
        ]);

      }

    );

  }

);
