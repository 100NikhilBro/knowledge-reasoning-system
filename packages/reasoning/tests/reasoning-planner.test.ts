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

      "should detect multi hop",

      async () => {

        const plan =
          await planner.plan({

            query:
              "Which proposal introduced typing and was proposed by Guido?"

          });

        expect(
          plan.strategy
        ).toBe("multi-hop");

      }

    );

  }

);