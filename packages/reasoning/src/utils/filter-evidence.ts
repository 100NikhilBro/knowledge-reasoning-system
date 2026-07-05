import type {
  Evidence
} from "@knowledge/shared";

export function filterEvidence(

  evidence: Evidence[],

  threshold = 0.5

): Evidence[] {

  return evidence.filter(

    item => item.score >= threshold

  );

}