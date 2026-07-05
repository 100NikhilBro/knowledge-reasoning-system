import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  KnowledgeEntity,
  KnowledgeRelationship,
  GraphNeighbor,
  GraphSubgraph,
  GraphPath
} from "@knowledge/shared";

import { GraphRetriever } from "../contracts/retriever.js";

export class Neo4jGraphRetriever
  implements GraphRetriever {

  constructor(
    private readonly graph =
      new GraphTraversalService()
  ) {}

  async findNode(
    id: string
  ): Promise<KnowledgeEntity | null> {

    return this.graph.findNodeById(
      "Proposal",
      id
    );

  }

  async findNeighbors(
    id: string
  ): Promise<GraphNeighbor[]> {

    return this.graph.findNeighbors(
      "Proposal",
      id
    );

  }

  async findRelationships(
    id: string
  ): Promise<KnowledgeRelationship[]> {

    return this.graph.findRelationships(
      "Proposal",
      id
    );

  }

  async findSubgraph(
    id: string
  ): Promise<GraphSubgraph> {

    return this.graph.findSubgraph(
      "Proposal",
      id
    );

  }

  async findShortestPath(
    from: string,
    to: string
  ): Promise<GraphPath | null> {

    return this.graph.findShortestPath(
      "Proposal",
      from,
      "Author",
      to
    );

  }

}