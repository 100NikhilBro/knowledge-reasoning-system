import type {
  Evidence
} from "@knowledge/shared";

export function mergeEvidence(

  left: Evidence,

  right: Evidence

): Evidence {

  return {

    ...left,

    score:

      Math.max(

        left.score,

        right.score

      ),

    entity: {

      ...left.entity,

      confidence:

        Math.max(

          left.entity.confidence,

          right.entity.confidence

        )

    }

  };

}