import {

  describe,
  expect,
  it

} from "vitest";

import {

  DFSTraversal

} from "../src/traversal/dfs-traversal.js";

describe(

  "DFS Traversal",

  () => {

    it(

      "should instantiate",

      () => {

        const dfs =

          new DFSTraversal();

        expect(

          dfs

        ).toBeDefined();

      }

    );

  }

);