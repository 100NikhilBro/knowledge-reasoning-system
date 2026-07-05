import type {
  Evidence
} from "@knowledge/shared";

import type {
  VerificationResult
} from "../types/verification-result.js";

import {
  DEFAULT_VERIFICATION_RULES
} from "./default-verification-rules.js";

export function verifyEvidence(

  evidence: Evidence[],

  rules = DEFAULT_VERIFICATION_RULES

): VerificationResult {

  const valid: Evidence[] = [];

  const rejected: Evidence[] = [];

  for (

    const item of evidence

  ) {

    const entity =

      item.entity;

    const isValid =

      entity.id.trim().length > 0 &&

      entity.type.trim().length > 0 &&

      (

        !rules.requireSource ||

        entity.source.trim().length > 0

      ) &&

      item.score >= rules.minimumScore &&

      entity.confidence >=

        rules.minimumConfidence &&

      rules.allowedEntityTypes.includes(

        entity.type

      );

    if (

      isValid

    ) {

      valid.push(

        item

      );

    }

    else {

      rejected.push(

        item

      );

    }

  }

  return {

    valid,

    rejected

  };

}