export function groupRelationshipsByType(relationships) {
    const groups = new Map();
    for (const relationship of relationships) {
        const bucket = groups.get(relationship.type);
        if (bucket) {
            bucket.push(relationship);
        }
        else {
            groups.set(relationship.type, [relationship]);
        }
    }
    return groups;
}
