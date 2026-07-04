import type { KnowledgeEntity } from "@knowledge/shared";

export class Neo4jNodeMapper {

  static toKnowledgeEntity(node: any): KnowledgeEntity {

    return {

      id: node.properties.id,

      type: node.labels[0],

      label: node.properties.label,

      source: node.properties.source,

      confidence: node.properties.confidence,

      properties: node.properties

    };

  }

}