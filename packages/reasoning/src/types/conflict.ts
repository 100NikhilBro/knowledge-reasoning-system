import type {
  Evidence
} from "@knowledge/shared";

export interface Conflict {

  entityId: string;

  left: Evidence;

  right: Evidence;

  reason: string;

}