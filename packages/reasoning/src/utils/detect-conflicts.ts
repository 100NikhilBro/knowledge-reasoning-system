import type {
  Evidence
} from "@knowledge/shared";

import type {
  Conflict
} from "../types/conflict.js";

export function detectConflicts(

  evidence: Evidence[]

): Conflict[] {

  const conflicts: Conflict[] = [];

  const seen =

    new Map<string, Evidence>();

  for (

    const item of evidence

  ) {

    const existing =

      seen.get(

        item.entity.id

      );

    if (

      existing &&

      existing.source !== item.source

    ) {

      conflicts.push({

        entityId:

          item.entity.id,

        left: existing,

        right: item,

        reason:

          "Conflicting sources"

      });

    }

    else {

      seen.set(

        item.entity.id,

        item

      );

    }

  }

  return conflicts;

}