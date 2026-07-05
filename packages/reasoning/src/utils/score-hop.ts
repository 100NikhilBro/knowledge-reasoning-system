import type {

  HopScore

} from "../types/hop-score.js";

export function scoreHop(

  depth: number,

  confidence: number

): HopScore {

  return {

    score:

      confidence /

      Math.max(

        depth,

        1

      )

  };

}