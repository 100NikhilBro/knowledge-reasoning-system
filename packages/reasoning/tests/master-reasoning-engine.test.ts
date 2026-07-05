import {

  describe,

  expect,

  it

} from "vitest";

import {

  DefaultMasterReasoningEngine

} from "../src/utils/master-reasoning-engine.js";

describe(

  "Master Reasoning Engine",

  () => {

    it(

      "returns engine context",

      () => {

        const engine =

          new DefaultMasterReasoningEngine();

        const context =

          {

            query: "AI"

          } as any;

        expect(

          engine.execute(

            context

          )

        ).toBe(

          context

        );

      }

    );

  }

);