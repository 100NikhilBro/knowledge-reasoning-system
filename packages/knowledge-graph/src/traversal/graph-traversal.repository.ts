import {
  buildGraphId,
  type KnowledgeEntity
} from "@knowledge/shared";

// import type { GraphPath } from "@knowledge/shared";

import type { KnowledgeRelationship } from "@knowledge/shared";
import type { GraphSubgraph } from "@knowledge/shared";

import { GraphRepository } from "../repositories/graph.repository.js";

import { Neo4jNodeMapper } from "../mappers/neo4j-node.mapper.js";
import { Neo4jRelationshipMapper } from "../mappers/neo4j-relationship.mapper.js";


export class GraphTraversalRepository {

  constructor(
    private readonly repository = new GraphRepository()
  ) {}

async findNodeById(
  label: string,
  id: string
): Promise<KnowledgeEntity | null> {

  const graphId = buildGraphId(
    label,
    id
  );

  const result = await this.repository.executeRead(
    `
    MATCH (n:${label} { id: $id })

    RETURN n
    `,
    {
      id: graphId
    }
  );

  if (result.records.length === 0) {
    return null;
  }

  const node = result.records[0].get("n");

return Neo4jNodeMapper.toKnowledgeEntity(node);

}



async findNeighbors(
  label: string,
  id: string
) {

  const graphId = buildGraphId(label, id);

  const result = await this.repository.executeRead(
    `
    MATCH (n:${label} { id: $id })-[r]-(neighbor)

    RETURN
      type(r) AS relationship,
      neighbor
    `,
    {
      id: graphId
    }
  );

  return result.records.map(record => ({

    relationship: record.get("relationship"),

    labels: record.get("neighbor").labels,

    properties: record.get("neighbor").properties

  }));

}


async findRelationships(
  label: string,
  id: string
) {

  const graphId = buildGraphId(label, id);

  const result = await this.repository.executeRead(
    `
    MATCH (n:${label} { id: $id })-[r]-()

    RETURN r
    `,
    {
      id: graphId
    }
  );

  return result.records.map(record => Neo4jRelationshipMapper.toRelationship(
        record.get("r")
    ));

}

async findNodesByLabel(
  label: string
) {

  const result = await this.repository.executeRead(
    `
    MATCH (n:${label})

    RETURN n
    `
  );

  return result.records.map(record => 

    Neo4jNodeMapper.toKnowledgeEntity(
        record.get("n")
    )
  );

}



async findSubgraph(
  label: string,
  id: string
): Promise<GraphSubgraph> {

  const graphId = buildGraphId(label, id);

  const result = await this.repository.executeRead(
    `
    MATCH (n:${label} { id: $id })-[r]-(neighbor)

    RETURN
      n,
      r,
      neighbor
    `,
    {
      id: graphId
    }
  );

  const nodes = new Map<string, KnowledgeEntity>();

  const relationships: KnowledgeRelationship[] = [];

  for (const record of result.records) {

    const node = Neo4jNodeMapper.toKnowledgeEntity(
      record.get("n")
    );

    const neighbor = Neo4jNodeMapper.toKnowledgeEntity(
      record.get("neighbor")
    );

    nodes.set(node.id, node);
    nodes.set(neighbor.id, neighbor);

    relationships.push({

      from: node.id,

      to: neighbor.id,

      ...Neo4jRelationshipMapper.toRelationship(
        record.get("r")
      )

    });

  }

  return {

    nodes: [...nodes.values()],

    relationships

  };

}

async findShortestPath(
  fromLabel: string,
  fromId: string,
  toLabel: string,
  toId: string
) {

  const fromGraphId = buildGraphId(fromLabel, fromId);
  const toGraphId = buildGraphId(toLabel, toId);

  const result = await this.repository.executeRead(
    `
    MATCH path = shortestPath(
      (a:${fromLabel} { id: $fromId })-[*]-(b:${toLabel} { id: $toId })
    )

    RETURN path
    `,
    {
      fromId: fromGraphId,
      toId: toGraphId
    }
  );

  if (result.records.length === 0) {
    return null;
  }

  const path = result.records[0].get("path");

const nodes = path.segments.flatMap((segment: any) => [

  Neo4jNodeMapper.toKnowledgeEntity(segment.start),

  Neo4jNodeMapper.toKnowledgeEntity(segment.end)

]);

const uniqueNodes = new Map();

for (const node of nodes) {

  uniqueNodes.set(node.id, node);

}

const relationships = path.segments.map((segment: any) => ({

  from: Neo4jNodeMapper.toKnowledgeEntity(
    segment.start
  ).id,

  to: Neo4jNodeMapper.toKnowledgeEntity(
    segment.end
  ).id,

  ...Neo4jRelationshipMapper.toRelationship(
    segment.relationship
  )

}));

return {

  nodes: [...uniqueNodes.values()],

  relationships,

  length: path.length

};

}

}