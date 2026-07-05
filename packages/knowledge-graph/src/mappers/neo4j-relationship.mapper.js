export class Neo4jRelationshipMapper {
    static toRelationship(relationship) {
        return {
            type: relationship.type,
            confidence: relationship.properties.confidence,
            properties: relationship.properties
        };
    }
}
