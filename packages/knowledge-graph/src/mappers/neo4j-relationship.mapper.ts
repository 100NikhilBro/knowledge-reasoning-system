// import type { KnowledgeRelationship } from "@knowledge/shared";

// export class Neo4jRelationshipMapper {

//   static toRelationship(
//     relationship: any
//   ): Pick<
//     KnowledgeRelationship,
//     "type" | "confidence" | "properties"
//   > {

//     return {

//       type: relationship.type,

//       confidence:
//         relationship.properties.confidence,

//       properties: relationship.properties

//     };

//   }

// }



import type { KnowledgeRelationship } from "@knowledge/shared";

export class Neo4jRelationshipMapper {

  static toKnowledgeRelationship(
    relationship: any,
    from: string,
    to: string
  ): KnowledgeRelationship {

    return {

      from,

      to,

      type: relationship.type,

      confidence:
        relationship.properties.confidence ?? 1,

      properties: relationship.properties

    };

  }

}