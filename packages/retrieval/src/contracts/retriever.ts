import type {
  KnowledgeEntity,
  KnowledgeRelationship,
  GraphNeighbor,
  GraphPath,
  GraphSubgraph
} from "@knowledge/shared";

import type { RetrievalQuery } from "../types/retrieval-query.js";
import type { RetrievalResult } from "../types/retrieval-result.js";



export interface GraphRetriever {

  retrieve(
  query: RetrievalQuery
): Promise<RetrievalResult[]>;

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