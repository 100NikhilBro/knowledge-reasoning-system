import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { GraphService } from "../src/services/graph.service.js";
import { closeDriver } from "../src/config/neo4j.js";

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

});