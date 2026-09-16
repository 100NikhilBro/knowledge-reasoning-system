import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  GraphNeighbor,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import { Neo4jGraphRetriever }
from "../src/graph/graph.retriever.js";

import { RetrievalService }
from "../src/services/retrieval.service.js";

import { SimpleRanker }
from "../src/ranking/simple-ranker.js";

function entity(
  id: string,
  type: KnowledgeEntity["type"],
  label: string
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "fixture.md",
    confidence: 1,
    properties: {}
  };
}

function rel(
  from: string,
  to: string,
  type: string
): KnowledgeRelationship {
  return {
    from,
    to,
    type,
    confidence: 1,
    properties: {}
  };
}

function neighbor(
  relationship: KnowledgeRelationship,
  node: KnowledgeEntity
): GraphNeighbor {
  return {
    relationship,
    neighbor: node
  };
}

describe("Prompt 3 — relationship-preserving retrieval expansion", () => {

  const alpha =
    entity("entity:alpha", "Proposal", "Alpha");
  const beta =
    entity("entity:beta", "Proposal", "Beta");
  const hub =
    entity("feature:hub", "Feature", "Hub");
  const gamma =
    entity("entity:gamma", "Proposal", "Gamma");

  const alphaToHub =
    rel(alpha.id, hub.id, "INTRODUCES");
  const betaToHub =
    rel(beta.id, hub.id, "INTRODUCES");
  const gammaToHub =
    rel(gamma.id, hub.id, "INTRODUCES");

  it("relationship metadata survives retrieval expansion", async () => {
    const findNeighbors =
      vi.fn(async (label: string, id: string) => {
        expect(label).toBeTruthy();
        if (id === alpha.id) {
          return [neighbor(alphaToHub, hub)];
        }
        if (id === beta.id) {
          return [neighbor(betaToHub, hub)];
        }
        return [];
      });

    const retriever =
      new Neo4jGraphRetriever({
        findNeighbors
      } as never);

    const expanded =
      await retriever.expandFromSeeds([alpha, beta], {
        maxNeighborsPerNode: 4,
        maxTotal: 12
      });

    expect(expanded).toHaveLength(2);
    expect(expanded.map(item => item.relationship)).toEqual(
      expect.arrayContaining([alphaToHub, betaToHub])
    );
    expect(
      expanded.every(item =>
        item.relationship.from &&
        item.relationship.to &&
        item.relationship.type
      )
    ).toBe(true);
  });

  it("path/edge direction is preserved (source and target)", async () => {
    const findNeighbors =
      vi.fn(async (_label: string, id: string) => {
        if (id === alpha.id) {
          return [neighbor(alphaToHub, hub)];
        }
        return [];
      });

    const retriever =
      new Neo4jGraphRetriever({
        findNeighbors
      } as never);

    const expanded =
      await retriever.expandFromSeeds([alpha]);

    expect(expanded[0]?.relationship.from).toBe(alpha.id);
    expect(expanded[0]?.relationship.to).toBe(hub.id);
    expect(expanded[0]?.relationship.type).toBe("INTRODUCES");
  });

  it("multiple independent branches to a hub are not collapsed", async () => {
    const findNeighbors =
      vi.fn(async (_label: string, id: string) => {
        if (id === alpha.id) {
          return [neighbor(alphaToHub, hub)];
        }
        if (id === beta.id) {
          return [neighbor(betaToHub, hub)];
        }
        if (id === gamma.id) {
          return [neighbor(gammaToHub, hub)];
        }
        return [];
      });

    const retriever =
      new Neo4jGraphRetriever({
        findNeighbors
      } as never);

    const expanded =
      await retriever.expandFromSeeds([alpha, beta, gamma]);

    expect(expanded).toHaveLength(3);
    expect(
      new Set(expanded.map(item => item.neighbor.id)).size
    ).toBe(1);
    expect(
      new Set(
        expanded.map(item =>
          `${item.relationship.from}|${item.relationship.type}|${item.relationship.to}`
        )
      ).size
    ).toBe(3);
  });

  it("RetrievalService attaches relationship onto expanded results", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            {
              entity: alpha,
              score: 0.9,
              source: "graph" as const
            },
            {
              entity: beta,
              score: 0.85,
              source: "graph" as const
            }
          ]),
          expandFromSeeds: vi.fn(async () => [
            neighbor(alphaToHub, hub),
            neighbor(betaToHub, hub)
          ])
        },
        {
          retrieve: vi.fn(async () => [])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "How are Alpha and Beta connected through Hub?",
        intent: "BRIDGE_RELATIONSHIP",
        entities: ["Alpha", "Beta", "Hub"],
        topK: 10,
        mode: "hybrid"
      });

    const withEdges =
      results.filter(item => item.relationship);

    expect(withEdges.length).toBeGreaterThanOrEqual(2);
    expect(
      withEdges.map(item => item.relationship)
    ).toEqual(
      expect.arrayContaining([alphaToHub, betaToHub])
    );
    expect(
      withEdges.every(item =>
        item.metadata?.relationshipType === item.relationship?.type
      )
    ).toBe(true);
  });

  it("unrelated expansion without relationship does not invent edges", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            {
              entity: alpha,
              score: 0.9,
              source: "graph" as const
            }
          ]),
          expandFromSeeds: vi.fn(async () => [])
        },
        {
          retrieve: vi.fn(async () => [])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "What is the direct relationship between Alpha and Hub?",
        intent: "DIRECT_RELATIONSHIP",
        entities: ["Alpha", "Hub"],
        topK: 8,
        mode: "hybrid"
      });

    expect(
      results.every(item => item.relationship === undefined)
    ).toBe(true);
    expect(
      results.every(item =>
        item.metadata?.relationshipType !== "RELATED" &&
        item.metadata?.fabricatedDirectEdge === undefined
      )
    ).toBe(true);
  });

});
