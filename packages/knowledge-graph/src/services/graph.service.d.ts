import type { KnowledgeEntity, KnowledgeRelationship } from "@knowledge/shared";
interface GraphHealth {
}
export declare class GraphService {
    private repository;
    healthCheck(): Promise<GraphHealth>;
    initialize(): Promise<void>;
    ingest(entities: KnowledgeEntity[], relationships: KnowledgeRelationship[]): Promise<void>;
    getNode(id: string): Promise<any>;
    getNodesByType(type: string): Promise<{
        labels: any;
        properties: any;
    }[]>;
    getNeighbors(id: string): Promise<{
        relationship: any;
        labels: any;
        properties: any;
    }[]>;
    getRelationships(id: string): Promise<{
        type: any;
        properties: any;
    }[]>;
    findPath(from: string, to: string): Promise<any>;
    disconnect(): Promise<void>;
}
export {};
