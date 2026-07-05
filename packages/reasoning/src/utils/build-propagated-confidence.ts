import {

  propagateConfidence

} from "./propagate-confidence.js";

import type {

  PropagatedConfidence

} from "../types/propagated-confidence.js";

export function buildPropagatedConfidence(

  depth: number

): PropagatedConfidence {

  return {

    depth,

    confidence:

      propagateConfidence(

        depth

      )

  };

}