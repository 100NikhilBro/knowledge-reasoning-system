export function normalizeRelationships(relationships) {
    return relationships.map(relationship => ({
        ...relationship,
        properties: relationship.properties ?? {}
    }));
}
