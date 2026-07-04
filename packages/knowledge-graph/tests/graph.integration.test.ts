import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { GraphService } from "../src/services/graph.service.js";
import { closeDriver } from "../src/config/neo4j.js";
import { GraphTraversalService } from "../src/traversal/graph-traversal.service.js";

describe("Graph Integration", () => {

  const graph = new GraphService();

  beforeAll(async () => {

    await graph.initialize();

  });

  afterAll(async () => {

    await closeDriver();

  });

  it("should connect to neo4j", async () => {

    const health = await graph.healthCheck();

    expect(health.address).toBeDefined();
    expect(health.agent).toContain("Neo4j");

  });

  it("should initialize graph schema", async () => {

    await expect(graph.initialize()).resolves.not.toThrow();

  });

  it("should return null for missing node", async () => {

    const node = await graph.getNode("unknown-id");

    expect(node).toBeNull();

  });

  it("should return empty neighbors for missing node", async () => {

    const neighbors = await graph.getNeighbors("unknown-id");

    expect(neighbors).toEqual([]);

  });



  it("should find proposal by id", async () => {

  const traversal = new GraphTraversalService();

  const proposal = await traversal.findNodeById(
    "Proposal",
    "PEP-484"
  );

  expect(proposal).not.toBeNull();

  expect(proposal?.id)
    .toBe("proposal:PEP-484");

});


it("should return proposal neighbors", async () => {

  const traversal = new GraphTraversalService();

  const neighbors = await traversal.findNeighbors(
    "Proposal",
    "PEP-484"
  );

  expect(neighbors.length).toBeGreaterThan(0);

});



it("should return proposal relationships", async () => {

  const traversal = new GraphTraversalService();

  const relationships =
    await traversal.findRelationships(
      "Proposal",
      "PEP-484"
    );

  expect(
    relationships.length
  ).toBeGreaterThan(0);

});

it("should return all proposals", async () => {

  const traversal = new GraphTraversalService();

  const proposals =
    await traversal.findNodesByLabel(
      "Proposal"
    );

  expect(proposals.length)
    .toBeGreaterThan(0);

});

it("should build proposal subgraph", async () => {

  const traversal = new GraphTraversalService();

  const subgraph =
    await traversal.findSubgraph(
      "Proposal",
      "PEP-484"
    );

  expect(subgraph.nodes.length)
    .toBeGreaterThan(1);

  expect(
    subgraph.relationships.length
  ).toBeGreaterThan(0);

});

it("should find shortest path", async () => {

  const traversal = new GraphTraversalService();

  const path =
    await traversal.findShortestPath(
      "Proposal",
      "PEP-484",
      "Author",
      "guido-van-rossum"
    );

  expect(path).not.toBeNull();

  expect(path?.length).toBe(1);

});



});