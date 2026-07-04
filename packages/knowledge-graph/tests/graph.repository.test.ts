import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from "vitest";

import { GraphRepository } from "../src/repositories/graph.repository.js";

describe("GraphRepository", () => {

  let repository: GraphRepository;

  beforeEach(() => {

    repository = new GraphRepository();

  });

  it("should call executeRead from findNodeById", async () => {

    const spy = vi.spyOn(repository, "executeRead");

    spy.mockResolvedValue({
      records: []
    } as any);

    await repository.findNodeById(
      "proposal:PEP-484"
    );

    expect(spy).toHaveBeenCalledOnce();

  });

  it("should call executeRead from findNodesByType", async () => {

    const spy = vi.spyOn(repository, "executeRead");

    spy.mockResolvedValue({
      records: []
    } as any);

    await repository.findNodesByType(
      "Proposal"
    );

    expect(spy).toHaveBeenCalledOnce();

  });

  it("should call executeRead from findNeighbors", async () => {

    const spy = vi.spyOn(repository, "executeRead");

    spy.mockResolvedValue({
      records: []
    } as any);

    await repository.findNeighbors(
      "proposal:PEP-484"
    );

    expect(spy).toHaveBeenCalledOnce();

  });

  it("should call executeRead from findRelationships", async () => {

    const spy = vi.spyOn(repository, "executeRead");

    spy.mockResolvedValue({
      records: []
    } as any);

    await repository.findRelationships(
      "proposal:PEP-484"
    );

    expect(spy).toHaveBeenCalledOnce();

  });

  it("should call executeRead from findPath", async () => {

    const spy = vi.spyOn(repository, "executeRead");

    spy.mockResolvedValue({
      records: []
    } as any);

    await repository.findPath(
      "proposal:PEP-484",
      "author:guido-van-rossum"
    );

    expect(spy).toHaveBeenCalledOnce();

  });

  it("should call executeWrite from createEntity", async () => {

    const spy = vi.spyOn(repository, "executeWrite");

    spy.mockResolvedValue({} as any);

    await repository.createEntity({

      id: "proposal:PEP-999",

      type: "Proposal",

      label: "Test Proposal",

      source: "test",

      confidence: 1,

      properties: {}

    });

    expect(spy).toHaveBeenCalledOnce();

  });

  it("should call executeWrite from createRelationship", async () => {

    const spy = vi.spyOn(repository, "executeWrite");

    spy.mockResolvedValue({} as any);

    await repository.createRelationship({

      from: "proposal:PEP-999",

      to: "author:test",

      type: "PROPOSED_BY",

      confidence: 1,

      properties: {}

    });

    expect(spy).toHaveBeenCalledOnce();

  });

});