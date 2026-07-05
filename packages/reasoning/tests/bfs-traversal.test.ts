import {

  describe,
  expect,
  it

} from "vitest";

import {

  BFSTraversal

} from "../src/traversal/bfs-traversal.js";

describe(

  "BFS Traversal",

  () => {

    it(

      "should instantiate",

      () => {

        const traversal =

          new BFSTraversal();

        expect(

          traversal

        ).toBeDefined();

      }

    );

  }

);