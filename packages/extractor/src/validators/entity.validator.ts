import type { KnowledgeEntity } from "../models/entity.js";

import { isAllowedEntityType } from "@knowledge/shared";

export class EntityValidator {

  validate(entity: KnowledgeEntity): boolean {

    if (!entity.id?.trim()) {
      return false;
    }

    if (!entity.type?.trim()) {
      return false;
    }

    if (!isAllowedEntityType(entity.type)) {
      return false;
    }

    if (!entity.label?.trim()) {
      return false;
    }

    if (!entity.source?.trim()) {
      return false;
    }

    return true;

  }

}
