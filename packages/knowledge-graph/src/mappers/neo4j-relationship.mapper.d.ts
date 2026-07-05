import type { KnowledgeRelationship } from "@knowledge/shared";
export declare class Neo4jRelationshipMapper {
    static toRelationship(relationship: any): Pick<KnowledgeRelationship, "type" | "confidence" | "properties">;
}
