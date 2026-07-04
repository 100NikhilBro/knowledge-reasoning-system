import type { KnowledgeRelationship } from "@knowledge/shared";

export class Neo4jRelationshipMapper {

  static toRelationship(
    relationship: any
  ): Pick<
    KnowledgeRelationship,
    "type" | "confidence" | "properties"
  > {

    return {

      type: relationship.type,

      confidence:
        relationship.properties.confidence,

      properties: relationship.properties

    };

  }

}