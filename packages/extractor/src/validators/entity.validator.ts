import type { KnowledgeEntity } from "../models/entity.js";

export class EntityValidator {

  validate(entity: KnowledgeEntity): boolean {

    if (!entity.id.trim()) {
      return false;
    }

    if (!entity.type.trim()) {
      return false;
    }

    if (!entity.label.trim()) {
      return false;
    }

    return true;

  }

}