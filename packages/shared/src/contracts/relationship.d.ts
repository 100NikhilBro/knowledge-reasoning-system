import { RelationshipType } from "../enums/relationship-type.js";
export interface Relationship {
    from: string;
    to: string;
    type: RelationshipType;
    properties?: Record<string, unknown>;
}
