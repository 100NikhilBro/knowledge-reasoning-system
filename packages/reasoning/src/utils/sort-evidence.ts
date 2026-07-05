import type {
  Evidence
} from "@knowledge/shared";

export function sortEvidence(

  evidence: Evidence[]

): Evidence[] {

  return [

    ...evidence

  ].sort(

    (a, b) =>

      b.score - a.score

  );

}