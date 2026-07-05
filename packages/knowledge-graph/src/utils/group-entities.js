export function groupEntitiesByType(entities) {
    const groups = new Map();
    for (const entity of entities) {
        const bucket = groups.get(entity.type);
        if (bucket) {
            bucket.push(entity);
        }
        else {
            groups.set(entity.type, [entity]);
        }
    }
    return groups;
}
