// import type {
//   Evidence
// } from "@knowledge/shared";

// import type {
//   Conflict
// } from "../types/conflict.js";

// import type {
//   ConflictResolution
// } from "../types/conflict-resolution.js";

// export function resolveConflicts(

//   evidence: Evidence[],

//   conflicts: Conflict[]

// ): ConflictResolution {

//   const resolved =

//     [...evidence];

//   return {

//     resolved,

//     unresolved: conflicts

//   };

// }


import type {
  Evidence
} from "@knowledge/shared";

import type {
  Conflict
} from "../types/conflict.js";

import type {
  ConflictResolution
} from "../types/conflict-resolution.js";

import type {
  ConflictPolicy
} from "../types/conflict-policy.js";

import {
  DEFAULT_CONFLICT_POLICY
} from "./default-conflict-policy.js";

export function resolveConflicts(

  evidence: Evidence[],

  conflicts: Conflict[],

  policy: ConflictPolicy =
    DEFAULT_CONFLICT_POLICY

): ConflictResolution {

  switch (policy) {

    case "keep-all":

      return {

        resolved: evidence,

        unresolved: []

      };

    case "highest-confidence":

    case "trusted-source":

    case "latest":

    case "merge":

    default:

      return {

        resolved: [...evidence],

        unresolved: conflicts

      };

  }

}