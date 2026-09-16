import { canonicalizeRelationshipType } from "@knowledge/shared";

export function normalizeRelationships(relationships) {
    return relationships.map(relationship => ({
        ...relationship,
        type: canonicalizeRelationshipType(relationship.type),
        properties: relationship.properties ?? {}
    }));
}
