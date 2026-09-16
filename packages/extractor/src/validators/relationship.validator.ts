import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";

import {
  canonicalizeRelationshipType,
  isAllowedRelationshipType,
  RELATIONSHIP_TYPE_CONSTRAINTS,
  type AllowedRelationshipType
} from "@knowledge/shared";

export class RelationshipValidator {

  validate(
    relationship: KnowledgeRelationship
  ): boolean {

    if (!relationship.from?.trim()) {
      return false;
    }

    if (!relationship.to?.trim()) {
      return false;
    }

    if (!relationship.type?.trim()) {
      return false;
    }

    return true;

  }

  /**
   * Validates canonical type membership and source/target type matrix.
   */
  validateEndpoints(
    relationship: KnowledgeRelationship,
    fromEntity: KnowledgeEntity,
    toEntity: KnowledgeEntity
  ): boolean {

    const type =
      canonicalizeRelationshipType(relationship.type);

    if (!isAllowedRelationshipType(type)) {
      return false;
    }

    const constraint =
      RELATIONSHIP_TYPE_CONSTRAINTS[
        type as AllowedRelationshipType
      ];

    return (
      (constraint.from as readonly string[])
        .includes(fromEntity.type) &&
      (constraint.to as readonly string[])
        .includes(toEntity.type)
    );

  }

}
