import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship,
  ReasoningPlan
} from "@knowledge/shared";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  interpretEvidencePaths
} from "../src/utils/interpret-path.js";

import {
  classifyRelationalSupport
} from "../src/utils/classify-relational-support.js";

import {
  evaluateClaimsAgainstEvidence,
  extractLogicalClaims
} from "../src/utils/logical-implication.js";

import {
  SingleHopStrategy
} from "../src/strategy/single-hop.strategy.js";

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

describe("Prompt 3.1 relationship claim binding and paths", () => {

  const A =
    entity("entity:a", "Proposal", "EntityA");
  const B =
    entity("entity:b", "Proposal", "EntityB");
  const X =
    entity("entity:x", "Feature", "HubX");
  const Y =
    entity("entity:y", "Feature", "HubY");
  const Z =
    entity("entity:z", "Feature", "HubZ");
  const C =
    entity("entity:c", "Feature", "NodeC");
  const D =
    entity("entity:d", "Feature", "NodeD");
  const typing =
    entity("feature:typing", "Feature", "Typing");
  const distributed =
    entity(
      "feature:distributed",
      "Feature",
      "DistributedComputing"
    );

  const aIntroducesTyping =
    rel(A.id, typing.id, "INTRODUCES");
  const aIntroducesX =
    rel(A.id, X.id, "INTRODUCES");
  const aAddressesX =
    rel(A.id, X.id, "ADDRESSES");
  const bIntroducesX =
    rel(B.id, X.id, "INTRODUCES");
  const bRelA =
    rel(B.id, A.id, "INTRODUCES");
  const aToY =
    rel(A.id, Y.id, "INTRODUCES");
  const bToZ =
    rel(B.id, Z.id, "INTRODUCES");
  const yToC =
    rel(Y.id, C.id, "RESULTS_IN");
  const zToD =
    rel(Z.id, D.id, "RESULTS_IN");
  const aToX =
    rel(A.id, X.id, "INTRODUCES");
  const xToB =
    rel(X.id, B.id, "RESULTS_IN");
  const bToY =
    rel(B.id, Y.id, "INTRODUCES");

  it("A: exact target mismatch → NOT_SUPPORTED", () => {
    const query =
      "Does EntityA introduce DistributedComputing?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(typing, aIntroducesTyping)
      ]);

    expect(understandQuery(query).requireTypedEdge).toEqual({
      subject: "EntityA",
      predicate: "INTRODUCES",
      object: "DistributedComputing",
      direction: "outgoing"
    });

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");

    expect(
      interpretEvidencePaths(query, context).supportsClaim
    ).toBe(false);

    expect(
      evaluateClaimsAgainstEvidence(
        extractLogicalClaims(query),
        context
      ).support
    ).toBe("NOT_SUPPORTED");
  });

  it("B: exact predicate mismatch → NOT_SUPPORTED", () => {
    const query =
      "Does EntityA introduce HubX?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(X, aAddressesX)
      ]);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");

    expect(
      interpretEvidencePaths(query, context).supportsClaim
    ).toBe(false);
  });

  it("C: source mismatch → NOT_SUPPORTED", () => {
    const query =
      "Does EntityA introduce HubX?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(B),
        evidenceOf(X, bIntroducesX)
      ]);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");
  });

  it("D: reverse direction → NOT_SUPPORTED for directed relation", () => {
    const query =
      "Does EntityA introduce EntityB?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(B, bRelA)
      ]);

    expect(
      evaluateClaimsAgainstEvidence(
        extractLogicalClaims(query),
        context
      ).support
    ).toBe("NOT_SUPPORTED");

    expect(
      interpretEvidencePaths(query, context).supportsClaim
    ).toBe(false);
  });

  it("E: valid direct → SUPPORTED", () => {
    const query =
      "Does EntityA introduce HubX?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(X, aIntroducesX)
      ]);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("full");

    const interpretation =
      interpretEvidencePaths(query, context);

    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.kind).toBe("DIRECT");
  });

  it("F: valid connected path A → X → B → SUPPORTED", () => {
    const query =
      "How are EntityA and EntityB connected?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(X, aToX),
        evidenceOf(B, xToB)
      ]);

    const interpretation =
      interpretEvidencePaths(query, context);

    expect(interpretation.supportsClaim).toBe(true);
    expect(["CONNECTED", "MULTI_HOP"]).toContain(interpretation.kind);
    expect(interpretation.path?.topology).toBe("directed_chain");
    expect(interpretation.path?.relationships).toHaveLength(2);
  });

  it("G: unrelated evidence pool → NOT_SUPPORTED for A-B", () => {
    const query =
      "How are EntityA and EntityB connected?";

    const context =
      ctx(query, [
        evidenceOf(A, aToY),
        evidenceOf(B, bToZ),
        evidenceOf(Y, yToC),
        evidenceOf(Z, zToD),
        evidenceOf(C),
        evidenceOf(D)
      ]);

    const interpretation =
      interpretEvidencePaths(query, context);

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.kind).toBe("INSUFFICIENT");
    expect(interpretation.hopCount).toBe(0);
    expect(interpretation.path).toBeUndefined();
    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");
  });

  it("H: valid shared-hub A → X ← B through X → SUPPORTED", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(B),
        evidenceOf(X, aIntroducesX),
        evidenceOf(X, bIntroducesX)
      ]);

    const interpretation =
      interpretEvidencePaths(query, context);

    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.kind).toBe("BRIDGE");
    expect(interpretation.path?.topology).toBe("shared_hub");
    expect(interpretation.path?.relationships).toHaveLength(2);
  });

  it("I: wrong bridge → NOT_SUPPORTED", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    const context =
      ctx(query, [
        evidenceOf(A, aToX),
        evidenceOf(B, bToY),
        evidenceOf(X),
        evidenceOf(Y)
      ]);

    const interpretation =
      interpretEvidencePaths(query, context);

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.kind).toBe("INSUFFICIENT");
    expect(interpretation.bridgeEntities).toEqual([]);
  });

  it("J: missing second hub edge → NOT_SUPPORTED", () => {
    const query =
      "How are EntityA and EntityB connected through HubX?";

    const context =
      ctx(query, [
        evidenceOf(A),
        evidenceOf(B),
        evidenceOf(X, aIntroducesX)
      ]);

    expect(
      interpretEvidencePaths(query, context).supportsClaim
    ).toBe(false);
  });

  it("K: production regression — introduce DistributedComputing → NOT_SUPPORTED", () => {
    const pep526 =
      entity(
        "proposal:PEP-526",
        "Proposal",
        "Variable Annotations"
      );

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

    expect(understandQuery(query).requireTypedEdge?.object)
      .toBe("DistributedComputing");

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

  it("L: production regression — connected through Typing → valid bridge", () => {
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

    const e526 =
      rel(pep526.id, typing.id, "INTRODUCES");
    const e604 =
      rel(pep604.id, typing.id, "INTRODUCES");

    const query =
      "How are PEP-526 and PEP-604 connected through Typing?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pep526),
          evidenceOf(pep604),
          evidenceOf(typing, e526),
          evidenceOf(typing, e604)
        ])
      );

    expect(interpretation.kind).toBe("BRIDGE");
    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.path?.topology).toBe("shared_hub");
    expect(interpretation.path?.relationships).toHaveLength(2);
  });

  it("M: production regression — directly related → NOT_SUPPORTED", () => {
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

    const query =
      "Are PEP-526 and PEP-604 directly related?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pep526),
          evidenceOf(pep604),
          evidenceOf(
            typing,
            rel(pep526.id, typing.id, "INTRODUCES")
          ),
          evidenceOf(
            typing,
            rel(pep604.id, typing.id, "INTRODUCES")
          )
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.kind).toBe("INSUFFICIENT");
  });

  it("N: production regression — connected only via valid path/bridge", () => {
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

    const query =
      "How are PEP-526 and PEP-604 connected?";

    const withBridge =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pep526),
          evidenceOf(pep604),
          evidenceOf(
            typing,
            rel(pep526.id, typing.id, "INTRODUCES")
          ),
          evidenceOf(
            typing,
            rel(pep604.id, typing.id, "INTRODUCES")
          )
        ])
      );

    expect(withBridge.supportsClaim).toBe(true);
    expect(withBridge.kind).toBe("BRIDGE");
    expect(withBridge.path).toBeDefined();

    const unrelated =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(
            pep526,
            rel(pep526.id, Y.id, "INTRODUCES")
          ),
          evidenceOf(
            pep604,
            rel(pep604.id, Z.id, "INTRODUCES")
          ),
          evidenceOf(Y),
          evidenceOf(Z)
        ])
      );

    expect(unrelated.supportsClaim).toBe(false);
    expect(unrelated.kind).toBe("INSUFFICIENT");
  });

  it("single-hop requireTypedEdge rejects same-predicate spillover object", async () => {
    const graph = {
      findNeighbors: async () => [
        {
          neighbor: typing,
          relationship: aIntroducesTyping
        },
        {
          neighbor: distributed,
          relationship:
            rel(A.id, distributed.id, "ADDRESSES")
        }
      ]
    };

    const plan: ReasoningPlan = {
      strategy: "single-hop",
      maxDepth: 1,
      traversal: "bfs",
      focusRelationships: ["INTRODUCES"],
      requireTypedEdge: {
        subject: "EntityA",
        predicate: "INTRODUCES",
        object: "DistributedComputing",
        direction: "outgoing"
      }
    };

    const strategy =
      new SingleHopStrategy();

    const result =
      await strategy.execute(
        graph as never,
        plan,
        {
          evidence: [
            evidenceOf(A),
            evidenceOf(typing),
            evidenceOf(distributed)
          ]
        }
      );

    expect(
      result.evidence.some(item =>
        item.relationship?.to === typing.id
      )
    ).toBe(false);

    expect(
      result.evidence.some(item =>
        item.relationship?.type === "INTRODUCES" &&
        item.relationship.to === distributed.id
      )
    ).toBe(false);
  });

});
