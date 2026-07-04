import type { KnowledgeEntity } from "@knowledge/shared";


export class EntityMapper {

  static toCypher(entity: KnowledgeEntity) {

    return {

      id: entity.id,

      label: entity.label,

      properties: entity.properties,

      type: entity.type

    };

  }

}