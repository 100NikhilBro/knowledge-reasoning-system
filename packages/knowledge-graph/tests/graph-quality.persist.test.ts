import { describe, expect, it, vi } from "vitest";

import { GraphRepository } from "../src/repositories/graph.repository.js";

describe("GraphRepository provenance merge", () => {

  it("uses ON CREATE/ON MATCH so repeated ingest does not overwrite source", async () => {

    const repository = new GraphRepository();

    const spy = vi.spyOn(repository, "executeWrite");

    spy.mockResolvedValue({} as any);

    await repository.createEntity({
      id: "feature:typing",
      type: "Feature",
      label: "Typing",
      source: "pep-484.md",
      confidence: 0.9,
      properties: { name: "Typing" }
    });

    const query = String(spy.mock.calls[0]?.[0] ?? "");

    expect(query).toContain("ON CREATE SET");
    expect(query).toContain("ON MATCH SET");
    expect(query).toContain("n.sources");
    expect(query).not.toMatch(
      /MERGE \(n:Feature \{ id: \$id \}\)\s+SET\s+n\.source = \$source/
    );

  });

  it("batch persist accumulates sources without replacing first source", async () => {

    const repository = new GraphRepository();

    const tx = {
      run: vi.fn(async () => ({}))
    };

    vi.spyOn(repository, "executeTransaction")
      .mockImplementation(async (callback) => {
        await callback(tx as any);
      });

    await repository.persist(
      [
        {
          id: "feature:typing",
          type: "Feature",
          label: "Typing",
          source: "pep-526.md",
          confidence: 0.9,
          properties: { name: "Typing" }
        }
      ],
      [
        {
          from: "proposal:PEP-526",
          to: "feature:typing",
          type: "INTRODUCES",
          confidence: 1,
          properties: {}
        }
      ]
    );

    const entityQuery = String(tx.run.mock.calls[0]?.[0] ?? "");

    expect(entityQuery).toContain("ON CREATE SET");
    expect(entityQuery).toContain("ON MATCH SET");
    expect(entityQuery).toContain("n.sources");
    expect(entityQuery).toContain("entity.source IN n.sources");

    const relationshipQuery =
      String(tx.run.mock.calls[1]?.[0] ?? "");

    expect(relationshipQuery).toContain("MERGE (from)-[r:INTRODUCES]->(to)");

  });

  it("normalizes relationship type variants before grouping", async () => {

    const repository = new GraphRepository();

    const tx = {
      run: vi.fn(async () => ({}))
    };

    vi.spyOn(repository, "executeTransaction")
      .mockImplementation(async (callback) => {
        await callback(tx as any);
      });

    await repository.persist(
      [
        {
          id: "proposal:PEP-484",
          type: "Proposal",
          label: "Type Hints",
          source: "pep-484.md",
          confidence: 1,
          properties: { pep: "484" }
        },
        {
          id: "author:guido-van-rossum",
          type: "Author",
          label: "Guido van Rossum",
          source: "pep-484.md",
          confidence: 1,
          properties: { name: "Guido van Rossum" }
        }
      ],
      [
        {
          from: "proposal:PEP-484",
          to: "author:guido-van-rossum",
          type: "proposed-by",
          confidence: 1
        }
      ]
    );

    const relationshipQuery =
      String(tx.run.mock.calls[2]?.[0] ?? "");

    expect(relationshipQuery).toContain("PROPOSED_BY");

  });

});
