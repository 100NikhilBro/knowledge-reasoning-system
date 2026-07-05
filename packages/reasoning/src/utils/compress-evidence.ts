import type {
  Evidence
} from "@knowledge/shared";

import {
  isDuplicateEvidence
} from "./is-duplicate-evidence.js";

import {
  mergeEvidence
} from "./merge-evidence.js";

export function compressEvidence(

  evidence: Evidence[]

): Evidence[] {

  const compressed: Evidence[] = [];

  for (

    const current of evidence

  ) {

    const index =

      compressed.findIndex(

        existing =>

          isDuplicateEvidence(

            existing,

            current

          )

      );

    if (

      index === -1

    ) {

      compressed.push(

        current

      );

      continue;

    }

    compressed[index] =

      mergeEvidence(

        compressed[index],

        current

      );

  }

  return compressed;

}