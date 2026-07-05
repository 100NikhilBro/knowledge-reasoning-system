import type {
  KnowledgeEntity,
  KnowledgeRelationship,
  GraphNeighbor,
  GraphPath,
  GraphSubgraph
} from "@knowledge/shared";

export interface GraphRetriever {

  findNode(
    id: string
  ): Promise<KnowledgeEntity | null>;

  findNeighbors(
    id: string
  ): Promise<GraphNeighbor[]>;

  findRelationships(
    id: string
  ): Promise<KnowledgeRelationship[]>;

  findSubgraph(
    id: string
  ): Promise<GraphSubgraph>;

  findShortestPath(
    from: string,
    to: string
  ): Promise<GraphPath | null>;

}