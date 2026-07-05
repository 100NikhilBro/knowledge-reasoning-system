import type {
  Evidence
} from "@knowledge/shared";

export function deduplicateEvidence(

  evidence: Evidence[]

): Evidence[] {

  const map = new Map<string, Evidence>();

  for (const item of evidence) {

    const existing = map.get(
      item.entity.id
    );

    if (

      !existing ||

      item.score > existing.score

    ) {

      map.set(
        item.entity.id,
        item
      );

    }

  }

  return [

    ...map.values()

  ];

}