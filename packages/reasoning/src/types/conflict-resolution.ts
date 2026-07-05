import type {
  Conflict
} from "./conflict.js";

import type {
  Evidence
} from "@knowledge/shared";

export interface ConflictResolution {

  resolved: Evidence[];

  unresolved: Conflict[];

}