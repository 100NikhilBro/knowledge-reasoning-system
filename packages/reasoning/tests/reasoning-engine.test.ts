import {

  describe,
  expect,
  it

} from "vitest";

import {

  DefaultReasoningEngine

} from "../src/services/reasoning-engine.service.js";

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

  }


);

it(

  "should execute pipeline",

  async () => {

    const engine =

      new DefaultReasoningEngine();

    await expect(

      engine.reason({

        query: "What is PEP-484?",

        topK: 5

      })

    ).resolves.toBeDefined();

  }

);