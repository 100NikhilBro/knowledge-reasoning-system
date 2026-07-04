import { EntityType } from "../enums/entity-type.js";

export interface Entity {

  id: string;

  type: EntityType;

  properties: Record<string, unknown>;

}