import type {

  HopSelection

} from "../types/hop-selection.js";

import {

  scoreHop

} from "./score-hop.js";

export function selectHop(

  depth: number,

  confidence: number,

  threshold = 0.30

): HopSelection {

  const score =

    scoreHop(

      depth,

      confidence

    );

  return {

    selected:

      score.score >= threshold

  };

}