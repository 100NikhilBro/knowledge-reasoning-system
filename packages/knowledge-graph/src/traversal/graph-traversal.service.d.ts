import type { KnowledgeEntity } from "@knowledge/shared";
import { GraphTraversalRepository } from "./graph-traversal.repository.js";
export declare class GraphTraversalService {
    private readonly repository;
    constructor(repository?: GraphTraversalRepository);
    findNodeById(label: string, id: string): Promise<KnowledgeEntity | null>;
    findNeighbors(label: string, id: string): Promise<{
        relationship: any;
        labels: any;
        properties: any;
    }[]>;
    findRelationships(label: string, id: string): Promise<Pick<import("@knowledge/shared").KnowledgeRelationship, "confidence" | "properties" | "type">[]>;
    findNodesByLabel(label: string): Promise<KnowledgeEntity[]>;
    findSubgraph(label: string, id: string): Promise<import("@knowledge/shared").GraphSubgraph>;
    findShortestPath(fromLabel: string, fromId: string, toLabel: string, toId: string): Promise<{
        nodes: any[];
        relationships: any;
        length: any;
    } | null>;
}
