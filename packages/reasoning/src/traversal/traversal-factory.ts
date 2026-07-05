import type {
  GraphTraversal
} from "../contracts/graph-traversal.js";

import {
  BFSTraversal
} from "./bfs-traversal.js";

import {
  DFSTraversal
} from "./dfs-traversal.js";

export type TraversalType =

  | "bfs"

  | "dfs";

export class TraversalFactory {

  static create(

    type: TraversalType

  ): GraphTraversal {

    switch (type) {

      case "dfs":

        return new DFSTraversal();

      default:

        return new BFSTraversal();

    }

  }

}