import {

  describe,
  expect,
  it

} from "vitest";

import {

  createEngineContext

} from "../src/utils/create-engine-context.js";

import {

  updateEngineContext

} from "../src/utils/update-engine-context.js";

describe(

  "Engine Context",

  () => {

    it(

      "updates context",

      () => {

        const context =

          createEngineContext(

            {

              query:

                "Docker"

            }

          );

        const updated =

          updateEngineContext(

            context,

            {

              collected: []

            }

          );

        expect(

          updated.collected

        ).toEqual(

          []

        );

      }

    );

  }

);