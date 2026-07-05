import { buildGraphId } from "@knowledge/shared";
import { GraphRepository } from "../repositories/graph.repository.js";
import { Neo4jNodeMapper } from "../mappers/neo4j-node.mapper.js";
import { Neo4jRelationshipMapper } from "../mappers/neo4j-relationship.mapper.js";
export class GraphTraversalRepository {
    repository;
    constructor(repository = new GraphRepository()) {
        this.repository = repository;
    }
    async findNodeById(label, id) {
        const graphId = buildGraphId(label, id);
        const result = await this.repository.executeRead(`
    MATCH (n:${label} { id: $id })

    RETURN n
    `, {
            id: graphId
        });
        if (result.records.length === 0) {
            return null;
        }
        const node = result.records[0].get("n");
        return Neo4jNodeMapper.toKnowledgeEntity(node);
    }
    async findNeighbors(label, id) {
        const graphId = buildGraphId(label, id);
        const result = await this.repository.executeRead(`
    MATCH (n:${label} { id: $id })-[r]-(neighbor)

    RETURN
      type(r) AS relationship,
      neighbor
    `, {
            id: graphId
        });
        return result.records.map(record => ({
            relationship: record.get("relationship"),
            labels: record.get("neighbor").labels,
            properties: record.get("neighbor").properties
        }));
    }
    async findRelationships(label, id) {
        const graphId = buildGraphId(label, id);
        const result = await this.repository.executeRead(`
    MATCH (n:${label} { id: $id })-[r]-()

    RETURN r
    `, {
            id: graphId
        });
        return result.records.map(record => Neo4jRelationshipMapper.toRelationship(record.get("r")));
    }
    async findNodesByLabel(label) {
        const result = await this.repository.executeRead(`
    MATCH (n:${label})

    RETURN n
    `);
        return result.records.map(record => Neo4jNodeMapper.toKnowledgeEntity(record.get("n")));
    }
    async findSubgraph(label, id) {
        const graphId = buildGraphId(label, id);
        const result = await this.repository.executeRead(`
    MATCH (n:${label} { id: $id })-[r]-(neighbor)

    RETURN
      n,
      r,
      neighbor
    `, {
            id: graphId
        });
        const nodes = new Map();
        const relationships = [];
        for (const record of result.records) {
            const node = Neo4jNodeMapper.toKnowledgeEntity(record.get("n"));
            const neighbor = Neo4jNodeMapper.toKnowledgeEntity(record.get("neighbor"));
            nodes.set(node.id, node);
            nodes.set(neighbor.id, neighbor);
            relationships.push({
                from: node.id,
                to: neighbor.id,
                ...Neo4jRelationshipMapper.toRelationship(record.get("r"))
            });
        }
        return {
            nodes: [...nodes.values()],
            relationships
        };
    }
    async findShortestPath(fromLabel, fromId, toLabel, toId) {
        const fromGraphId = buildGraphId(fromLabel, fromId);
        const toGraphId = buildGraphId(toLabel, toId);
        const result = await this.repository.executeRead(`
    MATCH path = shortestPath(
      (a:${fromLabel} { id: $fromId })-[*]-(b:${toLabel} { id: $toId })
    )

    RETURN path
    `, {
            fromId: fromGraphId,
            toId: toGraphId
        });
        if (result.records.length === 0) {
            return null;
        }
        const path = result.records[0].get("path");
        const nodes = path.segments.flatMap((segment) => [
            Neo4jNodeMapper.toKnowledgeEntity(segment.start),
            Neo4jNodeMapper.toKnowledgeEntity(segment.end)
        ]);
        const uniqueNodes = new Map();
        for (const node of nodes) {
            uniqueNodes.set(node.id, node);
        }
        const relationships = path.segments.map((segment) => ({
            from: Neo4jNodeMapper.toKnowledgeEntity(segment.start).id,
            to: Neo4jNodeMapper.toKnowledgeEntity(segment.end).id,
            ...Neo4jRelationshipMapper.toRelationship(segment.relationship)
        }));
        return {
            nodes: [...uniqueNodes.values()],
            relationships,
            length: path.length
        };
    }
}
