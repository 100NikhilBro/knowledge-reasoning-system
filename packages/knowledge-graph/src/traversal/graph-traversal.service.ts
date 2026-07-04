import type { KnowledgeEntity } from "@knowledge/shared";
import { GraphTraversalRepository } from "./graph-traversal.repository.js";

export class GraphTraversalService {

  constructor(
    private readonly repository = new GraphTraversalRepository()
  ) {}

  async findNodeById(
    label: string,
    id: string
  ): Promise<KnowledgeEntity | null> {

    return this.repository.findNodeById(
      label,
      id
    );

  }


  async findNeighbors(
  label: string,
  id: string
) {

  return this.repository.findNeighbors(
    label,
    id
  );

}

async findRelationships(
  label: string,
  id: string
) {

  return this.repository.findRelationships(
    label,
    id
  );

}

async findNodesByLabel(
  label: string
) {

  return this.repository.findNodesByLabel(
    label
  );

}


async findSubgraph(
  label: string,
  id: string
) {

  return this.repository.findSubgraph(
    label,
    id
  );


}



async findShortestPath(
  fromLabel: string,
  fromId: string,
  toLabel: string,
  toId: string
) {

  return this.repository.findShortestPath(
    fromLabel,
    fromId,
    toLabel,
    toId
  );

}

}