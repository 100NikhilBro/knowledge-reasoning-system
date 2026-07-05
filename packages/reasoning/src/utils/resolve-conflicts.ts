import type {
  Evidence
} from "@knowledge/shared";

import type {
  Conflict
} from "../types/conflict.js";

import type {
  ConflictResolution
} from "../types/conflict-resolution.js";

export function resolveConflicts(

  evidence: Evidence[],

  conflicts: Conflict[]

): ConflictResolution {

  const resolved =

    [...evidence];

  return {

    resolved,

    unresolved: conflicts

  };

}