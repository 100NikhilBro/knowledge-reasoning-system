import {

  DEFAULT_CONFIDENCE_PROPAGATION

} from "./default-confidence-propagation.js";

export function propagateConfidence(

  depth: number

): number {

  return (

    DEFAULT_CONFIDENCE_PROPAGATION.initial *

    Math.pow(

      DEFAULT_CONFIDENCE_PROPAGATION.decay,

      depth

    )

  );

}