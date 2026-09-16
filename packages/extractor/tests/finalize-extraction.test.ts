import { describe, expect, it } from "vitest";

import { finalizeExtraction } from "../src/pipeline/finalize-extraction.js";

import type { KnowledgeEntity } from "../src/models/entity.js";
import type { KnowledgeRelationship } from "../src/models/relationship.js";

function entity(
  partial: Partial<KnowledgeEntity> &
    Pick<KnowledgeEntity, "id" | "type" | "label">
): KnowledgeEntity {

  return {
    source: "pep-484.md",
    confidence: 1,
    properties: {},
    ...partial
  };

}

describe("finalizeExtraction", () => {

  it("merges formatting variants of the same entity", () => {

    const result = finalizeExtraction(
      [
        entity({
          id: "proposal:PEP 484",
          type: "Proposal",
          label: "Type Hints",
          properties: { pep: "484" }
        }),
        entity({
          id: "proposal:pep484",
          type: "Proposal",
          label: "Type Hints",
          properties: { pep: "PEP-484" }
        })
      ],
      []
    );

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]?.id).toBe("proposal:PEP-484");
    expect(result.rejectedEntities).toHaveLength(0);

  });

  it("shares canonical entities across documents", () => {

    const fromPep484 = entity({
      id: "feature:Typing",
      type: "Feature",
      label: "Typing",
      source: "pep-484.md",
      properties: { name: "Typing" }
    });

    const fromPep526 = entity({
      id: "feature:typing",
      type: "Feature",
      label: "typing",
      source: "pep-526.md",
      properties: { name: "typing" }
    });

    const first = finalizeExtraction([fromPep484], []);
    const second = finalizeExtraction([fromPep526], []);

    expect(first.entities[0]?.id)
      .toBe(second.entities[0]?.id);

    expect(first.entities[0]?.id).toBe("feature:typing");

  });

  it("does not merge genuinely different entities", () => {

    const result = finalizeExtraction(
      [
        entity({
          id: "proposal:PEP-484",
          type: "Proposal",
          label: "Type Hints",
          properties: { pep: "484" }
        }),
        entity({
          id: "proposal:PEP-8",
          type: "Proposal",
          label: "Style Guide",
          properties: { pep: "8" }
        }),
        entity({
          id: "feature:typing",
          type: "Feature",
          label: "Typing",
          properties: { name: "Typing" }
        }),
        entity({
          id: "feature:asyncio",
          type: "Feature",
          label: "Asyncio",
          properties: { name: "Asyncio" }
        })
      ],
      []
    );

    const ids = result.entities.map(item => item.id).sort();

    expect(ids).toEqual([
      "feature:asyncio",
      "feature:typing",
      "proposal:PEP-484",
      "proposal:PEP-8"
    ]);

  });

  it("canonicalizes relationship types and rejects invalid ones", () => {

    const entities = [
      entity({
        id: "proposal:PEP-484",
        type: "Proposal",
        label: "Type Hints",
        properties: { pep: "484" }
      }),
      entity({
        id: "author:guido-van-rossum",
        type: "Author",
        label: "Guido van Rossum",
        properties: { name: "Guido van Rossum" }
      }),
      entity({
        id: "feature:typing",
        type: "Feature",
        label: "Typing",
        properties: { name: "Typing" }
      })
    ];

    const relationships: KnowledgeRelationship[] = [
      {
        from: "proposal:PEP-484",
        to: "author:guido-van-rossum",
        type: "proposed_by",
        confidence: 1
      },
      {
        from: "proposal:PEP-484",
        to: "feature:typing",
        type: "RELATED_TO",
        confidence: 1
      }
    ];

    const result = finalizeExtraction(entities, relationships);

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]?.type).toBe("PROPOSED_BY");

    expect(result.rejectedRelationships).toHaveLength(1);
    expect(result.rejectedRelationships[0]?.reason)
      .toBe("unsupported_relationship_type");

  });

  it("rejects invalid source/target type combinations", () => {

    const entities = [
      entity({
        id: "proposal:PEP-484",
        type: "Proposal",
        label: "Type Hints",
        properties: { pep: "484" }
      }),
      entity({
        id: "feature:typing",
        type: "Feature",
        label: "Typing",
        properties: { name: "Typing" }
      })
    ];

    const result = finalizeExtraction(
      entities,
      [
        {
          from: "feature:typing",
          to: "proposal:PEP-484",
          type: "PROPOSED_BY",
          confidence: 1
        }
      ]
    );

    expect(result.relationships).toHaveLength(0);
    expect(result.rejectedRelationships[0]?.reason)
      .toBe("invalid_endpoint_types");

  });

  it("deduplicates identical relationships", () => {

    const entities = [
      entity({
        id: "proposal:PEP-484",
        type: "Proposal",
        label: "Type Hints",
        properties: { pep: "484" }
      }),
      entity({
        id: "feature:typing",
        type: "Feature",
        label: "Typing",
        properties: { name: "Typing" }
      })
    ];

    const result = finalizeExtraction(
      entities,
      [
        {
          from: "proposal:PEP-484",
          to: "feature:typing",
          type: "INTRODUCES",
          confidence: 0.9
        },
        {
          from: "proposal:PEP-484",
          to: "feature:typing",
          type: "introduces",
          confidence: 0.8
        }
      ]
    );

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]?.type).toBe("INTRODUCES");

  });

  it("preserves source provenance on entities", () => {

    const result = finalizeExtraction(
      [
        entity({
          id: "proposal:PEP-484",
          type: "Proposal",
          label: "Type Hints",
          source: "pep-484.md",
          properties: { pep: "484" }
        })
      ],
      []
    );

    expect(result.entities[0]?.source).toBe("pep-484.md");

  });

  it("supports multi-document entity sharing without colliding proposals", () => {

    const pep484 = finalizeExtraction(
      [
        entity({
          id: "proposal:PEP-484",
          type: "Proposal",
          label: "Type Hints",
          source: "pep-484.md",
          properties: { pep: "484" }
        }),
        entity({
          id: "feature:typing",
          type: "Feature",
          label: "Typing",
          source: "pep-484.md",
          properties: { name: "Typing" }
        })
      ],
      [
        {
          from: "proposal:PEP-484",
          to: "feature:typing",
          type: "INTRODUCES",
          confidence: 1
        }
      ]
    );

    const pep526 = finalizeExtraction(
      [
        entity({
          id: "proposal:PEP-526",
          type: "Proposal",
          label: "Syntax for Variable Annotations",
          source: "pep-526.md",
          properties: { pep: "526" }
        }),
        entity({
          id: "feature:Typing",
          type: "Feature",
          label: "Typing",
          source: "pep-526.md",
          properties: { name: "Typing" }
        })
      ],
      [
        {
          from: "proposal:PEP-526",
          to: "feature:Typing",
          type: "INTRODUCES",
          confidence: 1
        }
      ]
    );

    const sharedFeatureIds = [
      pep484.entities.find(e => e.type === "Feature")?.id,
      pep526.entities.find(e => e.type === "Feature")?.id
    ];

    expect(sharedFeatureIds[0]).toBe("feature:typing");
    expect(sharedFeatureIds[1]).toBe("feature:typing");

    expect(
      pep484.entities.find(e => e.type === "Proposal")?.id
    ).toBe("proposal:PEP-484");

    expect(
      pep526.entities.find(e => e.type === "Proposal")?.id
    ).toBe("proposal:PEP-526");

  });

});
