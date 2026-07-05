import type {
  KnowledgeEntity
} from "@knowledge/shared";

import {
  TraversalGuard
} from "../utils/traversal-guard.js";


export interface TraversalState {

  queue: KnowledgeEntity[];

  visited: TraversalGuard;

  result: KnowledgeEntity[];

  depth: number;

}