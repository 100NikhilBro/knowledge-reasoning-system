import { type KnowledgeEntity } from "@knowledge/shared";
import type { KnowledgeRelationship } from "@knowledge/shared";
import type { GraphSubgraph } from "@knowledge/shared";
import { GraphRepository } from "../repositories/graph.repository.js";
export declare class GraphTraversalRepository {
    private readonly repository;
    constructor(repository?: GraphRepository);
    findNodeById(label: string, id: string): Promise<KnowledgeEntity | null>;
    findNeighbors(label: string, id: string): Promise<{
        relationship: any;
        labels: any;
        properties: any;
    }[]>;
    findRelationships(label: string, id: string): Promise<Pick<KnowledgeRelationship, "confidence" | "properties" | "type">[]>;
    findNodesByLabel(label: string): Promise<KnowledgeEntity[]>;
    findSubgraph(label: string, id: string): Promise<GraphSubgraph>;
    findShortestPath(fromLabel: string, fromId: string, toLabel: string, toId: string): Promise<{
        nodes: any[];
        relationships: any;
        length: any;
    } | null>;
}
