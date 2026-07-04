import type { KnowledgeRelationship } from "@knowledge/shared";

export class RelationshipMapper {

  static toCypher(relationship: KnowledgeRelationship) {

    return {

      from: relationship.from,

      to: relationship.to,

      type: relationship.type,

      properties: relationship.properties ?? {}

    };

  }

}