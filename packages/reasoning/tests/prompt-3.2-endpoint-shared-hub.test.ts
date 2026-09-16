import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence,
  GraphPath,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  interpretEvidencePaths,
  validateEndpointPath,
  validateSharedHubBridge,
  reconstructSharedHubPath
} from "../src/utils/interpret-path.js";

import {
  classifyRelationalSupport
} from "../src/utils/classify-relational-support.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

function entity(
  id: string,
  type: string,
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

function evidenceOf(
  node: KnowledgeEntity,
  relationship?: KnowledgeRelationship,
  score = 0.95
): Evidence {
  return {
    entity: node,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

function ctx(
  query: string,
  evidence: Evidence[]
): ReasoningContext {
  return {
    query,
    understanding: understandQuery(query),
    evidence,
    items: evidence.map(item => ({
      entityId: item.entity.id,
      entityType: item.entity.type,
      label: item.entity.label,
      source: item.entity.source,
      score: item.score,
      properties: item.entity.properties ?? {},
      ...(item.relationship
        ? { relationship: item.relationship }
        : {}),
      ...(item.path ? { path: item.path } : {})
    }))
  };
}

describe("Prompt 3.2 strict endpoint + shared-hub validation", () => {

  const A =
    entity("entity:a", "Proposal", "EntityA");
  const B =
    entity("entity:b", "Proposal", "EntityB");
  const X =
    entity("feature:hubx", "Feature", "HubX");
  const Y =
    entity("feature:huby", "Feature", "HubY");
  const Z =
    entity("feature:hubz", "Feature", "HubZ");
  const C =
    entity("entity:c", "Decision", "Final");
  const V1 =
    entity("version:3.6", "PythonVersion", "3.6");
  const V2 =
    entity("version:3.10", "PythonVersion", "3.10");

  const aToX =
    rel(A.id, X.id, "INTRODUCES");
  const xToB =
    rel(X.id, B.id, "RESULTS_IN");
  const bToX =
    rel(B.id, X.id, "INTRODUCES");
  const aToY =
    rel(A.id, Y.id, "INTRODUCES");
  const bToZ =
    rel(B.id, Z.id, "INTRODUCES");
  const aToFinal =
    rel(A.id, C.id, "RESULTS_IN");
  const finalToV1 =
    rel(C.id, V1.id, "IMPLEMENTED_IN");
  const finalToV2 =
    rel(C.id, V2.id, "IMPLEMENTED_IN");
  const bToY =
    rel(B.id, Y.id, "INTRODUCES");

  it("1: valid directed chain A→X→B", () => {
    const query =
      "How are EntityA and EntityB connected?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToX),
          evidenceOf(X, xToB),
          evidenceOf(B)
        ])
      );

    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.kind).toBe("CONNECTED");
    expect(interpretation.path?.topology).toBe("directed_chain");
    expect(interpretation.path?.nodes[0]?.id).toBe(A.id);
    expect(interpretation.path?.nodes.at(-1)?.id).toBe(B.id);
    expect(interpretation.hopCount).toBe(2);
    expect(
      validateEndpointPath(
        interpretation.path,
        "EntityA",
        "EntityB",
        []
      )
    ).toBe(true);
  });

  it("2: invalid unrelated evidence pool", () => {
    const query =
      "How are EntityA and EntityB connected?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToY),
          evidenceOf(A, aToFinal),
          evidenceOf(B, bToZ),
          evidenceOf(C, finalToV1),
          evidenceOf(C, finalToV2),
          evidenceOf(Y),
          evidenceOf(Z),
          evidenceOf(V1),
          evidenceOf(V2)
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.kind).toBe("INSUFFICIENT");
    expect(interpretation.hopCount).toBe(0);
    expect(interpretation.relationships).toEqual([]);
    expect(interpretation.bridgeEntities).toEqual([]);
    expect(interpretation.path).toBeUndefined();
  });

  it("3: wrong endpoint start rejected", () => {
    const path: GraphPath = {
      nodes: [Y, X, B],
      relationships: [
        rel(Y.id, X.id, "INTRODUCES"),
        xToB
      ],
      length: 2,
      topology: "directed_chain"
    };

    expect(
      validateEndpointPath(path, "EntityA", "EntityB", [])
    ).toBe(false);
  });

  it("4: wrong endpoint goal rejected", () => {
    const path: GraphPath = {
      nodes: [A, X, Y],
      relationships: [
        aToX,
        rel(X.id, Y.id, "RESULTS_IN")
      ],
      length: 2,
      topology: "directed_chain"
    };

    expect(
      validateEndpointPath(path, "EntityA", "EntityB", [])
    ).toBe(false);
  });

  it("5: missing intermediate edge rejected", () => {
    const path: GraphPath = {
      nodes: [A, X, B],
      relationships: [aToX],
      length: 1,
      topology: "directed_chain"
    };

    expect(
      validateEndpointPath(path, "EntityA", "EntityB", [])
    ).toBe(false);
  });

  it("6: mismatched relationship endpoint rejected", () => {
    const path: GraphPath = {
      nodes: [A, X, B],
      relationships: [
        aToX,
        rel(Y.id, B.id, "RESULTS_IN")
      ],
      length: 2,
      topology: "directed_chain"
    };

    expect(
      validateEndpointPath(path, "EntityA", "EntityB", [])
    ).toBe(false);
  });

  it("7: valid shared hub A→X←B", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToX),
          evidenceOf(B, bToX),
          evidenceOf(X)
        ])
      );

    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.kind).toBe("BRIDGE");
    expect(interpretation.path?.topology).toBe("shared_hub");
    expect(interpretation.path?.relationships).toHaveLength(2);
    expect(interpretation.hopCount).toBe(2);
    expect(
      validateSharedHubBridge(
        interpretation.path,
        "EntityA",
        "EntityB",
        "HubX"
      )
    ).toBe(true);
  });

  it("8: missing A→X spoke", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    expect(
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(B, bToX),
          evidenceOf(X),
          evidenceOf(A)
        ])
      ).supportsClaim
    ).toBe(false);
  });

  it("9: missing B→X spoke", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    expect(
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToX),
          evidenceOf(X),
          evidenceOf(B)
        ])
      ).supportsClaim
    ).toBe(false);
  });

  it("10: wrong bridge X/Y", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToY),
          evidenceOf(B, bToY),
          evidenceOf(Y),
          evidenceOf(X)
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.kind).toBe("INSUFFICIENT");
    expect(interpretation.bridgeEntities).toEqual([]);
  });

  it("11: bridge requested but only unrelated evidence", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToFinal),
          evidenceOf(C, finalToV1),
          evidenceOf(B, bToZ)
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.relationships).toEqual([]);
    expect(interpretation.hopCount).toBe(0);
  });

  it("12: no fallback to relationshipTypes", () => {
    const query =
      "How are EntityA and EntityB connected?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToFinal),
          evidenceOf(B, bToZ),
          evidenceOf(C, finalToV1)
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.relationships).toEqual([]);
    expect(interpretation.relationships).not.toContain("RESULTS_IN");
    expect(interpretation.relationships).not.toContain("INTRODUCES");
  });

  it("13: no fabricated hop count", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(A, aToX),
          evidenceOf(B)
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.hopCount).toBe(0);
  });

  it("14: production PEP-526/PEP-604 through Typing", () => {
    const pep526 =
      entity(
        "proposal:PEP-526",
        "Proposal",
        "Variable Annotations"
      );
    const pep604 =
      entity(
        "proposal:PEP-604",
        "Proposal",
        "Union X | Y"
      );
    const typing =
      entity("feature:typing", "Feature", "Typing");

    const e526 =
      rel(pep526.id, typing.id, "INTRODUCES");
    const e604 =
      rel(pep604.id, typing.id, "INTRODUCES");

    const query =
      "How are PEP-526 and PEP-604 connected through Typing?";

    /*
     * Production shape: spokes present on proposal rows; hub entity may
     * be absent from the endpoint list.
     */
    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pep526, e526),
          evidenceOf(pep604, e604)
        ])
      );

    expect(interpretation.kind).toBe("BRIDGE");
    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.path?.topology).toBe("shared_hub");
    expect(interpretation.path?.relationships).toHaveLength(2);
    expect(interpretation.path?.nodes[1]?.id).toBe(typing.id);
    expect(interpretation.bridgeEntities.join(" ")).toMatch(/Typing|typing/i);
    expect(interpretation.hopCount).toBe(2);

    expect(
      reconstructSharedHubPath(
        ctx(query, [
          evidenceOf(pep526, e526),
          evidenceOf(pep604, e604)
        ]),
        "PEP-526",
        "PEP-604",
        "Typing"
      )?.relationships.map(item => `${item.from}->${item.to}`)
    ).toEqual(
      expect.arrayContaining([
        `${pep526.id}->${typing.id}`,
        `${pep604.id}->${typing.id}`
      ])
    );
  });

  it("15: production PEP-526/PEP-604 connected uses Typing hub not Final", () => {
    const pep526 =
      entity(
        "proposal:PEP-526",
        "Proposal",
        "Variable Annotations"
      );
    const pep604 =
      entity(
        "proposal:PEP-604",
        "Proposal",
        "Union X | Y"
      );
    const typing =
      entity("feature:typing", "Feature", "Typing");
    const finalNode =
      entity("decision:final", "Decision", "Final");

    const e526 =
      rel(pep526.id, typing.id, "INTRODUCES");
    const e604 =
      rel(pep604.id, typing.id, "INTRODUCES");
    const eFinal =
      rel(pep526.id, finalNode.id, "RESULTS_IN");
    const eImpl =
      rel(finalNode.id, V1.id, "IMPLEMENTED_IN");

    const query =
      "How are PEP-526 and PEP-604 connected?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pep526, e526),
          evidenceOf(pep526, eFinal),
          evidenceOf(pep604, e604),
          evidenceOf(finalNode, eImpl),
          evidenceOf(V1)
        ])
      );

    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.kind).toBe("BRIDGE");
    expect(interpretation.path?.topology).toBe("shared_hub");
    expect(
      interpretation.bridgeEntities.join(" ")
    ).toMatch(/Typing|typing/i);
    expect(
      interpretation.bridgeEntities.join(" ")
    ).not.toMatch(/Final/i);
  });

  it("16: production wrong Readability bridge fails closed", () => {
    const pep526 =
      entity(
        "proposal:PEP-526",
        "Proposal",
        "Variable Annotations"
      );
    const pep604 =
      entity(
        "proposal:PEP-604",
        "Proposal",
        "Union X | Y"
      );
    const typing =
      entity("feature:typing", "Feature", "Typing");
    const readability =
      entity(
        "concern:readability",
        "Concern",
        "Readability"
      );

    const query =
      "How are PEP-526 and PEP-604 connected through Readability?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(
            pep526,
            rel(pep526.id, typing.id, "INTRODUCES")
          ),
          evidenceOf(
            pep604,
            rel(pep604.id, typing.id, "INTRODUCES")
          ),
          evidenceOf(readability)
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.kind).toBe("INSUFFICIENT");
    expect(interpretation.bridgeEntities).toEqual([]);
  });

  it("17: direct relationship regression", () => {
    const pep526 =
      entity(
        "proposal:PEP-526",
        "Proposal",
        "Variable Annotations"
      );
    const typing =
      entity("feature:typing", "Feature", "Typing");

    const query =
      "What is the direct relationship between PEP-526 and Typing?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(
            pep526,
            rel(pep526.id, typing.id, "INTRODUCES")
          ),
          evidenceOf(typing)
        ])
      );

    expect(interpretation.kind).toBe("DIRECT");
    expect(interpretation.supportsClaim).toBe(true);
  });

  it("18: exact target binding regression", () => {
    const pep526 =
      entity(
        "proposal:PEP-526",
        "Proposal",
        "Variable Annotations"
      );
    const typing =
      entity("feature:typing", "Feature", "Typing");

    const query =
      "Does PEP-526 introduce DistributedComputing?";

    const context =
      ctx(query, [
        evidenceOf(pep526),
        evidenceOf(
          typing,
          rel(pep526.id, typing.id, "INTRODUCES")
        )
      ]);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");

    expect(
      interpretEvidencePaths(query, context).supportsClaim
    ).toBe(false);

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      verifier.verify({
        result: {
          answer: "PEP-526 introduces Typing.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
  });

  it("shared-hub reconstructs when hub entity row is missing", () => {
    const path =
      reconstructSharedHubPath(
        ctx(
          "How are EntityA and EntityB connected through HubX?",
          [
            evidenceOf(A, aToX),
            evidenceOf(B, bToX)
          ]
        ),
        "EntityA",
        "EntityB",
        "HubX"
      );

    expect(path?.topology).toBe("shared_hub");
    expect(path?.relationships).toHaveLength(2);
    expect(path?.nodes[1]?.id).toBe(X.id);
  });

});
