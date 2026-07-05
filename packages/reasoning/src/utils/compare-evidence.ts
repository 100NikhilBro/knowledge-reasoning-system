import type {
  Evidence,
  EvidenceSet
} from "@knowledge/shared";

export interface ComparisonResult {

  common: Evidence[];

  onlyLeft: Evidence[];

  onlyRight: Evidence[];

}

export function compareEvidence(

  left: EvidenceSet,

  right: EvidenceSet

): ComparisonResult {

  const leftMap =

    new Map(

      left.evidence.map(

        e => [

          e.entity.id,

          e

        ]

      )

    );

  const rightMap =

    new Map(

      right.evidence.map(

        e => [

          e.entity.id,

          e

        ]

      )

    );

  const common: Evidence[] = [];

  const onlyLeft: Evidence[] = [];

  const onlyRight: Evidence[] = [];

  for (

    const [id, evidence]

    of leftMap

  ) {

    if (

      rightMap.has(id)

    ) {

      common.push(

        evidence

      );

    }

    else {

      onlyLeft.push(

        evidence

      );

    }

  }

  for (

    const [id, evidence]

    of rightMap

  ) {

    if (

      !leftMap.has(id)

    ) {

      onlyRight.push(

        evidence

      );

    }

  }

  return {

    common,

    onlyLeft,

    onlyRight

  };

}