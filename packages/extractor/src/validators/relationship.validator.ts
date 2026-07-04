import type { KnowledgeRelationship } from "../models/relationship.js";

export class RelationshipValidator {

  validate(
    relationship: KnowledgeRelationship
  ): boolean {

    if (!relationship.from.trim()) {
      return false;
    }

    if (!relationship.to.trim()) {
      return false;
    }

    if (!relationship.type.trim()) {
      return false;
    }

    return true;

  }

}