import {
  describe,
  it,
  expect,
  beforeEach,
  vi
} from "vitest";

import { GraphService } from "../src/services/graph.service.js";
import { GraphRepository } from "../src/repositories/graph.repository.js";

vi.mock("../src/repositories/graph.repository.js");

describe("GraphService", () => {

  let service: GraphService;

  let repository: GraphRepository;

  beforeEach(() => {

    repository = {

      initializeSchema: vi.fn(),

      persist: vi.fn(),

      findNodeById: vi.fn(),

      findNodesByType: vi.fn(),

      findNeighbors: vi.fn(),

      findRelationships: vi.fn(),

      findPath: vi.fn()

    } as unknown as GraphRepository;

    service = new GraphService();

    (service as any).repository = repository;

  });

  it("should initialize schema", async () => {

    await service.initialize();

    expect(repository.initializeSchema)
      .toHaveBeenCalledOnce();

  });

  it("should persist graph", async () => {

    await service.ingest([], []);

    expect(repository.persist)
      .toHaveBeenCalledOnce();

  });

  it("should delegate getNode", async () => {

    await service.getNode("proposal:PEP-484");

    expect(repository.findNodeById)
      .toHaveBeenCalledOnce();

  });

  it("should delegate getNodesByType", async () => {

    await service.getNodesByType("Proposal");

    expect(repository.findNodesByType)
      .toHaveBeenCalledOnce();

  });

  it("should delegate getNeighbors", async () => {

    await service.getNeighbors("proposal:PEP-484");

    expect(repository.findNeighbors)
      .toHaveBeenCalledOnce();

  });

  it("should delegate getRelationships", async () => {

    await service.getRelationships("proposal:PEP-484");

    expect(repository.findRelationships)
      .toHaveBeenCalledOnce();

  });

  it("should delegate findPath", async () => {

    await service.findPath(
      "proposal:PEP-484",
      "author:guido-van-rossum"
    );

    expect(repository.findPath)
      .toHaveBeenCalledOnce();

  });

});