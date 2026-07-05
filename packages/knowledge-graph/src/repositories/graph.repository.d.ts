import type { KnowledgeEntity, KnowledgeRelationship } from "@knowledge/shared";
import type { QueryResult, ManagedTransaction } from "neo4j-driver";
export declare class GraphRepository {
    executeWrite(query: string, params?: Record<string, unknown>): Promise<QueryResult>;
    executeRead(query: string, params?: Record<string, unknown>): Promise<QueryResult>;
    initializeSchema(): Promise<void>;
    createEntity(entity: KnowledgeEntity): Promise<void>;
    createRelationship(relationship: KnowledgeRelationship): Promise<void>;
    private batchCreateEntities;
    private batchCreateRelationships;
    persist(entities: KnowledgeEntity[], relationships: KnowledgeRelationship[]): Promise<void>;
    findNodeById(id: string): Promise<any>;
    findNodesByType(type: string): Promise<{
        labels: any;
        properties: any;
    }[]>;
    findNeighbors(id: string): Promise<{
        relationship: any;
        labels: any;
        properties: any;
    }[]>;
    findRelationships(id: string): Promise<{
        type: any;
        properties: any;
    }[]>;
    findPath(from: string, to: string): Promise<any>;
    executeTransaction(callback: (tx: ManagedTransaction) => Promise<void>): Promise<void>;
}
