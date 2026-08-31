import { describe, expect, it, vi } from "vitest";

import type { ParsedDocument } from "@knowledge/parser";

import type {
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  DocumentIngestionService
} from "../src/services/document-ingestion.service.js";

import { IngestionError }
from "../src/errors/ingestion-error.js";

function createDocument(): ParsedDocument {

  return {
    metadata: {
      pep: "484",
      title: "Type Hints"
    },
    sections: [],
    raw: "PEP: 484",
    warnings: []
  };

}

function createEntity(
  id: string
): KnowledgeEntity {

  return {
    id,
    type: "Proposal",
    label: "Type Hints",
    source: "pep-484.md",
    confidence: 1,
    properties: { pep: "484" }
  };

}

function createRelationship(): KnowledgeRelationship {

  return {
    from: "proposal:PEP-484",
    to: "author:guido",
    type: "PROPOSED_BY",
    confidence: 1
  };

}

describe("DocumentIngestionService", () => {

  it("runs parser → extraction → graph → vector indexing for a valid job", async () => {

    const document = createDocument();
    const entities = [
      createEntity("proposal:PEP-484"),
      createEntity("feature:typing")
    ];
    const relationships = [createRelationship()];

    const files = {
      exists: vi.fn(async () => true),
      read: vi.fn(async () => "PEP: 484\nTitle: Type Hints")
    };

    const parser = {
      parse: vi.fn(() => ({
        document,
        errors: []
      }))
    };

    const entityExtractor = {
      extract: vi.fn(() => entities)
    };

    const relationshipExtractor = {
      extract: vi.fn(() => relationships)
    };

    const graph = {
      initialize: vi.fn(async () => undefined),
      ingest: vi.fn(async () => undefined)
    };

    const indexer = {
      index: vi.fn(async () => ({
        indexed: 2,
        entityIds: entities.map(entity => entity.id)
      }))
    };

    const service =
      new DocumentIngestionService({
        files,
        parser,
        entityExtractor,
        relationshipExtractor,
        graph,
        indexer
      });

    const result =
      await service.ingest({
        documentPath: "knowledge_state/raw/python-peps/pep-484.md",
        documentId: "pep-484",
        source: "python-peps"
      });

    expect(files.exists).toHaveBeenCalledWith(
      "knowledge_state/raw/python-peps/pep-484.md"
    );

    expect(files.read).toHaveBeenCalledOnce();

    expect(parser.parse).toHaveBeenCalledWith(
      "PEP: 484\nTitle: Type Hints"
    );

    expect(entityExtractor.extract)
      .toHaveBeenCalledWith(document);

    expect(relationshipExtractor.extract)
      .toHaveBeenCalledWith(entities);

    expect(graph.initialize).toHaveBeenCalledOnce();

    expect(graph.ingest).toHaveBeenCalledWith(
      entities,
      relationships
    );

    expect(indexer.index).toHaveBeenCalledWith(
      entities,
      {
        metadata: {
          documentId: "pep-484",
          documentPath:
            "knowledge_state/raw/python-peps/pep-484.md",
          source: "python-peps"
        }
      }
    );

    expect(result).toEqual({
      documentPath:
        "knowledge_state/raw/python-peps/pep-484.md",
      documentId: "pep-484",
      entityCount: 2,
      relationshipCount: 1,
      indexedCount: 2,
      entityIds: [
        "proposal:PEP-484",
        "feature:typing"
      ]
    });

  });

  it("fails explicitly when the document is missing", async () => {

    const service =
      new DocumentIngestionService({
        files: {
          exists: vi.fn(async () => false),
          read: vi.fn()
        },
        parser: { parse: vi.fn() },
        entityExtractor: { extract: vi.fn() },
        relationshipExtractor: { extract: vi.fn() },
        graph: { ingest: vi.fn() },
        indexer: { index: vi.fn() }
      });

    await expect(
      service.ingest({
        documentPath: "missing.md"
      })
    ).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND"
    });

  });

  it("propagates downstream failures and does not mark success", async () => {

    const graphIngest = vi.fn(async () => {
      throw new Error("neo4j unavailable");
    });

    const indexer = {
      index: vi.fn()
    };

    const service =
      new DocumentIngestionService({
        files: {
          exists: vi.fn(async () => true),
          read: vi.fn(async () => "content")
        },
        parser: {
          parse: vi.fn(() => ({
            document: createDocument(),
            errors: []
          }))
        },
        entityExtractor: {
          extract: vi.fn(() => [
            createEntity("proposal:PEP-484")
          ])
        },
        relationshipExtractor: {
          extract: vi.fn(() => [])
        },
        graph: {
          initialize: vi.fn(async () => undefined),
          ingest: graphIngest
        },
        indexer,
        initializeGraphSchema: true
      });

    await expect(
      service.ingest({
        documentPath: "pep-484.md"
      })
    ).rejects.toThrow("neo4j unavailable");

    expect(indexer.index).not.toHaveBeenCalled();

  });

  it("completes only after all required stages finish", async () => {

    const order: string[] = [];

    const service =
      new DocumentIngestionService({
        files: {
          exists: vi.fn(async () => {
            order.push("exists");
            return true;
          }),
          read: vi.fn(async () => {
            order.push("read");
            return "content";
          })
        },
        parser: {
          parse: vi.fn(() => {
            order.push("parse");
            return {
              document: createDocument(),
              errors: []
            };
          })
        },
        entityExtractor: {
          extract: vi.fn(() => {
            order.push("entities");
            return [createEntity("proposal:PEP-484")];
          })
        },
        relationshipExtractor: {
          extract: vi.fn(() => {
            order.push("relationships");
            return [];
          })
        },
        graph: {
          initialize: vi.fn(async () => {
            order.push("graph.initialize");
          }),
          ingest: vi.fn(async () => {
            order.push("graph.ingest");
          })
        },
        indexer: {
          index: vi.fn(async () => {
            order.push("index");
            return {
              indexed: 1,
              entityIds: ["proposal:PEP-484"]
            };
          })
        }
      });

    await service.ingest({
      documentPath: "pep-484.md"
    });

    expect(order).toEqual([
      "exists",
      "read",
      "parse",
      "entities",
      "relationships",
      "graph.initialize",
      "graph.ingest",
      "index"
    ]);

  });

  it("supports injected mocked dependencies", async () => {

    const indexer = {
      index: vi.fn(async () => ({
        indexed: 0,
        entityIds: []
      }))
    };

    const service =
      new DocumentIngestionService({
        files: {
          exists: vi.fn(async () => true),
          read: vi.fn(async () => "x")
        },
        parser: {
          parse: vi.fn(() => ({
            document: createDocument(),
            errors: []
          }))
        },
        entityExtractor: {
          extract: vi.fn(() => [])
        },
        relationshipExtractor: {
          extract: vi.fn(() => [])
        },
        graph: {
          ingest: vi.fn(async () => undefined)
        },
        indexer,
        initializeGraphSchema: false
      });

    const result =
      await service.ingest({
        documentPath: "empty.md"
      });

    expect(result.entityCount).toBe(0);
    expect(indexer.index).toHaveBeenCalledOnce();

  });

  it("rejects blank documentPath", async () => {

    const service =
      new DocumentIngestionService({
        files: {
          exists: vi.fn(),
          read: vi.fn()
        },
        parser: { parse: vi.fn() },
        entityExtractor: { extract: vi.fn() },
        relationshipExtractor: { extract: vi.fn() },
        graph: { ingest: vi.fn() },
        indexer: { index: vi.fn() }
      });

    await expect(
      service.ingest({ documentPath: "  " })
    ).rejects.toBeInstanceOf(IngestionError);

  });

});
