import type {

  Evidence

} from "@knowledge/shared";

import type {

  EvidenceBudget

} from "../types/evidence-budget.js";

export function applyEvidenceBudget(

  evidence: Evidence[],

  budget: EvidenceBudget

): Evidence[] {

  return evidence

    .slice(

      0,

      budget.maxEvidence

    );

}