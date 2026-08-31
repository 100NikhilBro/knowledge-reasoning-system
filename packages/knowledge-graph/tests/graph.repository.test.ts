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

  it("should persist Decision and PythonVersion entities", async () => {

    const spy = vi.spyOn(repository, "executeWrite");

    spy.mockResolvedValue({} as any);

    await repository.createEntity({
      id: "decision:accepted",
      type: "Decision",
      label: "Accepted",
      source: "pep-484.md",
      confidence: 1,
      properties: { outcome: "Accepted" }
    });

    await repository.createEntity({
      id: "pythonversion:3.5",
      type: "PythonVersion",
      label: "3.5",
      source: "pep-484.md",
      confidence: 1,
      properties: { version: "3.5" }
    });

    expect(spy).toHaveBeenCalledTimes(2);

    expect(String(spy.mock.calls[0]?.[0] ?? ""))
      .toContain("Decision");

    expect(String(spy.mock.calls[1]?.[0] ?? ""))
      .toContain("PythonVersion");

  });

  it("should persist RESULTS_IN and IMPLEMENTED_IN relationships", async () => {

    const spy = vi.spyOn(repository, "executeWrite");

    spy.mockResolvedValue({} as any);

    await repository.createRelationship({
      from: "proposal:PEP-484",
      to: "decision:accepted",
      type: "RESULTS_IN",
      confidence: 1,
      properties: {}
    });

    await repository.createRelationship({
      from: "decision:accepted",
      to: "pythonversion:3.5",
      type: "IMPLEMENTED_IN",
      confidence: 1,
      properties: {}
    });

    expect(spy).toHaveBeenCalledTimes(2);

    expect(String(spy.mock.calls[0]?.[0] ?? ""))
      .toContain("RESULTS_IN");

    expect(String(spy.mock.calls[1]?.[0] ?? ""))
      .toContain("IMPLEMENTED_IN");

  });

});
