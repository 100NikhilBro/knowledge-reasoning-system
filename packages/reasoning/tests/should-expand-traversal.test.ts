import {

  describe,
  expect,
  it

} from "vitest";

import {

  shouldExpandTraversal

} from "../src/utils/should-expand-traversal.js";

describe(

  "Should Expand Traversal",

  () => {

    it(

      "expands bfs traversal",

      () => {

        expect(

          shouldExpandTraversal({

            strategy: "bfs",

            depth: {

              depth: 1

            }

          })

        ).toBe(

          true

        );

      }

    );

    it(

      "expands deep dfs traversal",

      () => {

        expect(

          shouldExpandTraversal({

            strategy: "dfs",

            depth: {

              depth: 5

            }

          })

        ).toBe(

          true

        );

      }

    );

    it(

      "does not expand shallow dfs traversal",

      () => {

        expect(

          shouldExpandTraversal({

            strategy: "dfs",

            depth: {

              depth: 2

            }

          })

        ).toBe(

          false

        );

      }

    );

  }

);