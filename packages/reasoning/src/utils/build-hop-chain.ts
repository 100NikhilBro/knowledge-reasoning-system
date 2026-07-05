import type {

  HopChain

} from "../types/hop-chain.js";

import {

  selectHop

} from "./select-hop.js";

export function buildHopChain(

  maxDepth: number,

  confidence: number

): HopChain {

  const hops: number[] = [];

  for (

    let depth = 1;

    depth <= maxDepth;

    depth++

  ) {

    if (

      !selectHop(

        depth,

        confidence

      ).selected

    ) {

      break;

    }

    hops.push(

      depth

    );

  }

  return {

    hops

  };

}