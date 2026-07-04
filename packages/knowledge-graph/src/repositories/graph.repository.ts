import type {
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import { normalizeRelationships } from "../utils/normalize-relationships.js";

import { driver } from "../config/neo4j.js";

import type {
  QueryResult,
  ManagedTransaction
} from "neo4j-driver";


import { groupEntitiesByType } from "../utils/group-entities.js";
import { groupRelationshipsByType } from "../utils/group-relationships.js";

import { CONSTRAINTS } from "../schema/constraints.js";
import { INDEXES } from "../schema/indexes.js";

export class GraphRepository {

  async executeWrite(
    query: string,
    params: Record<string, unknown> = {}
  ): Promise<QueryResult> {

    const session = driver.session();

    try {

      return await session.executeWrite(tx =>
        tx.run(query, params)
      );

    } finally {

      await session.close();

    }

  }

  async executeRead(
    query: string,
    params: Record<string, unknown> = {}
  ): Promise<QueryResult> {

    const session = driver.session();

    try {

      return await session.executeRead(tx =>
        tx.run(query, params)
      );

    } finally {

      await session.close();

    }

  }


  async initializeSchema(): Promise<void> {

  for (const constraint of CONSTRAINTS) {
    await this.executeWrite(constraint);
  }

  for (const index of INDEXES) {
    await this.executeWrite(index);
  }

}

  async createEntity(
    entity: KnowledgeEntity
  ): Promise<void> {

    await this.executeWrite(
      `
      MERGE (n:${entity.type} { id: $id })

      SET
        n.label = $label,
        n.source = $source,
        n.confidence = $confidence

      SET n += $properties
      `,
      {
        id: entity.id,
        label: entity.label,
        source: entity.source,
        confidence: entity.confidence,
        properties: entity.properties
      }
    );

  }

  async createRelationship(
    relationship: KnowledgeRelationship
  ): Promise<void> {

    await this.executeWrite(
      `
      MATCH (from { id: $from })

      MATCH (to { id: $to })

      MERGE (from)-[r:${relationship.type}]->(to)

      SET
        r.confidence = $confidence

      SET r += $properties
      `,
      {
        from: relationship.from,
        to: relationship.to,
        confidence: relationship.confidence,
        properties: relationship.properties ?? {}
      }
    );

  }

  







private async batchCreateEntities(
  tx: ManagedTransaction,
  label: string,
  entities: KnowledgeEntity[]
): Promise<void> {

  if (entities.length === 0) {
    return;
  }

  await tx.run(
    `
    UNWIND $entities AS entity

    MERGE (n:${label} { id: entity.id })

    SET
      n.label = entity.label,
      n.source = entity.source,
      n.confidence = entity.confidence

    SET n += entity.properties
    `,
    {
      entities
    }
  );

}



private async batchCreateRelationships(
  tx: ManagedTransaction,
  type: string,
  relationships: KnowledgeRelationship[]
): Promise<void> {

  if (relationships.length === 0) {
    return;
  }

  await tx.run(
    `
    UNWIND $relationships AS relationship

    MATCH (from { id: relationship.from })

    MATCH (to { id: relationship.to })

    MERGE (from)-[r:${type}]->(to)

    SET
      r.confidence = relationship.confidence

    SET r += relationship.properties
    `,
    {
      relationships
    }
  );

}

async persist(
  entities: KnowledgeEntity[],
  relationships: KnowledgeRelationship[]
): Promise<void> {

  const groupedEntities = groupEntitiesByType(entities);
  const normalizedRelationships =
  normalizeRelationships(relationships);

const groupedRelationships =
  groupRelationshipsByType(normalizedRelationships);

  await this.executeTransaction(async (tx) => {

    for (const [label, items] of groupedEntities) {
      await this.batchCreateEntities(tx, label, items);
    }

    for (const [type, items] of groupedRelationships) {
      await this.batchCreateRelationships(tx, type, items);
    }

  });

}


  async findNodeById(id: string) {

  const result = await this.executeRead(
    `
    MATCH (n { id: $id })
    RETURN n
    `,
    { id }
  );

  if (result.records.length === 0) {
    return null;
  }

  return result.records[0].get("n").properties;

}

async findNodesByType(type: string) {

  const result = await this.executeRead(
    `
    MATCH (n)
    WHERE $type IN labels(n)
    RETURN n
    `,
    { type }
  );

  return result.records.map(record => ({
    labels: record.get("n").labels,
    properties: record.get("n").properties
  }));

}

async findNeighbors(id: string) {

  const result = await this.executeRead(
    `
    MATCH (n { id: $id })-[r]-(neighbor)
    RETURN
      type(r) AS relationship,
      neighbor
    `,
    { id }
  );

  return result.records.map(record => ({
    relationship: record.get("relationship"),
    labels: record.get("neighbor").labels,
    properties: record.get("neighbor").properties
  }));

}


async findRelationships(id: string) {

  const result = await this.executeRead(
    `
    MATCH (n { id: $id })-[r]-()
    RETURN r
    `,
    { id }
  );

  return result.records.map(record => ({
    type: record.get("r").type,
    properties: record.get("r").properties
  }));

}



async findPath(
  from: string,
  to: string
) {

  const result = await this.executeRead(
    `
    MATCH path = shortestPath(
      (a { id: $from })-[*]-(b { id: $to })
    )

    RETURN path
    `,
    {
      from,
      to
    }
  );

  if (result.records.length === 0) {
    return null;
  }

  return result.records[0].get("path");

}

async executeTransaction(
  callback: (tx: ManagedTransaction) => Promise<void>
): Promise<void> {

  const session = driver.session();

  try {

    await session.executeWrite(async tx => {
      await callback(tx);
    });

  } finally {

    await session.close();

  }

}

}