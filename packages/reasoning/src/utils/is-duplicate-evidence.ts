import type {
  Evidence
} from "@knowledge/shared";

export function isDuplicateEvidence(

  left: Evidence,

  right: Evidence

): boolean {

  return (

    left.entity.id ===

      right.entity.id &&

    left.source ===

      right.source

  );

}