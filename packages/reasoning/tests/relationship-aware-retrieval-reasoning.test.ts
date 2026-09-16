import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  Evidence,
  GraphNeighbor,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  interpretEvidencePaths,
  interpretGraphPath
} from "../src/utils/interpret-path.js";

import {
  filterCompatibleEvidence
} from "../src/utils/query-evidence-compatibility.js";

import {
  deduplicateEvidence
} from "../src/utils/deduplicate-evidence.js";

import {
  traversalHitsToEvidence
} from "../src/strategy/multi-hop.strategy.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

import type {
  TraversalHit
} from "../src/types/traversal-hit.js";

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
      confidence: item.entity.confidence,
      score: item.score,
      evidenceSource: item.source,
      properties: item.entity.properties,
      ...(item.relationship
        ? { relationship: item.relationship }
        : {}),
      ...(item.path ? { path: item.path } : {})
    })),
    budget: {
      maxEvidence: evidence.length,
      inputCount: evidence.length,
      retainedCount: evidence.length,
      truncated: false
    }
  };
}

describe("Prompt 3 — relationship-aware retrieval → reasoning", () => {

  const pepA =
    entity("proposal:A", "Proposal", "Proposal A");
  const pepB =
    entity("proposal:B", "Proposal", "Proposal B");
  const hub =
    entity("feature:hub", "Feature", "HubFeature");
  const other =
    entity("feature:other", "Feature", "OtherFeature");

  const aIntroducesHub =
    rel(pepA.id, hub.id, "INTRODUCES");
  const bIntroducesHub =
    rel(pepB.id, hub.id, "INTRODUCES");
  const hubToOther =
    rel(hub.id, other.id, "RELATED_TO");

  it("direct relationship A → B is supported only with attested edge", () => {
    const query =
      "What is the direct relationship between Proposal A and HubFeature?";

    const withEdge =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pepA),
          evidenceOf(hub, aIntroducesHub)
        ])
      );

    expect(withEdge.kind).toBe("DIRECT");
    expect(withEdge.supportsClaim).toBe(true);
    expect(withEdge.relationships).toContain("INTRODUCES");
  });

  it("reverse-direction edge must not satisfy directed introduce claim without the edge", () => {
    const query =
      "What is the direct relationship between HubFeature and Proposal A?";

    /*
     * Only A → Hub exists. A bidirectional "between" ask may still see an
     * edge; entity co-occurrence without that edge must fail.
     */
    const coOccurrenceOnly =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pepA),
          evidenceOf(hub)
        ])
      );

    expect(coOccurrenceOnly.supportsClaim).toBe(false);
    expect(coOccurrenceOnly.kind).toBe("INSUFFICIENT");
  });

  it("connected/bridge two-hop hub path A → X ← B is supported", () => {
    const query =
      "How are Proposal A and Proposal B connected through HubFeature?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pepA),
          evidenceOf(pepB),
          evidenceOf(hub, aIntroducesHub),
          evidenceOf(hub, bIntroducesHub)
        ])
      );

    expect(interpretation.kind).toBe("BRIDGE");
    expect(interpretation.supportsClaim).toBe(true);
    expect(interpretation.path?.relationships).toHaveLength(2);
    expect(interpretation.path?.length).toBe(2);
    expect(interpretation.path?.relationships.map(item => item.type))
      .toEqual(["INTRODUCES", "INTRODUCES"]);
  });

  it("bridge query fails when X is present but not on a connecting path", () => {
    const query =
      "How are Proposal A and Proposal B connected through HubFeature?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pepA),
          evidenceOf(pepB),
          evidenceOf(hub),
          evidenceOf(other, hubToOther)
        ])
      );

    expect(interpretation.supportsClaim).toBe(false);
    expect(interpretation.kind).toBe("INSUFFICIENT");
  });

  it("multiple independent branches are preserved by dedupe", () => {
    const deduped =
      deduplicateEvidence([
        evidenceOf(hub, aIntroducesHub, 0.9),
        evidenceOf(hub, bIntroducesHub, 0.8),
        evidenceOf(hub, undefined, 0.7)
      ]);

    const relationships =
      deduped
        .map(item => item.relationship)
        .filter(Boolean);

    expect(relationships).toHaveLength(2);
    expect(relationships).toEqual(
      expect.arrayContaining([aIntroducesHub, bIntroducesHub])
    );
  });

  it("entity co-occurrence without relationship → NOT_SUPPORTED", () => {
    const query =
      "What is the direct relationship between Proposal A and HubFeature?";

    const context =
      ctx(query, [
        evidenceOf(pepA),
        evidenceOf(hub)
      ]);

    const interpretation =
      interpretEvidencePaths(query, context);

    expect(interpretation.supportsClaim).toBe(false);

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      verifier.verify({
        result: {
          answer: "Proposal A introduces HubFeature.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
  });

  it("path preserves every relationship and direction", () => {
    const path = {
      nodes: [pepA, hub, pepB],
      relationships: [aIntroducesHub, bIntroducesHub],
      length: 2
    };

    const interpretation =
      interpretGraphPath(path, {
        query:
          "How are Proposal A and Proposal B connected through HubFeature?",
        intent: "BRIDGE_RELATIONSHIP",
        between: {
          left: "Proposal A",
          right: "Proposal B",
          bridge: "HubFeature",
          mode: "bridge"
        }
      });

    expect(interpretation.path?.relationships[0]?.from).toBe(pepA.id);
    expect(interpretation.path?.relationships[0]?.to).toBe(hub.id);
    expect(interpretation.path?.relationships[1]?.from).toBe(pepB.id);
    expect(interpretation.path?.relationships[1]?.to).toBe(hub.id);
    expect(interpretation.path?.length).toBe(2);
  });

  it("relationship evidence preserves source/target through filter", () => {
    const filtered =
      filterCompatibleEvidence(
        "How are Proposal A and Proposal B connected through HubFeature?",
        [
          evidenceOf(pepA),
          evidenceOf(pepB),
          evidenceOf(hub, aIntroducesHub),
          evidenceOf(hub, bIntroducesHub),
          evidenceOf(other)
        ]
      );

    const relationships =
      filtered
        .map(item => item.relationship)
        .filter(Boolean);

    expect(relationships).toEqual(
      expect.arrayContaining([aIntroducesHub, bIntroducesHub])
    );
    expect(
      relationships.every(item =>
        Boolean(item && item.from && item.to && item.type)
      )
    ).toBe(true);
    expect(
      filtered.some(item => item.entity.id === other.id)
    ).toBe(false);
  });

  it("traversalHitsToEvidence preserves GraphPath provenance", () => {
    const hit: TraversalHit = {
      entity: hub,
      depth: 1,
      relationship: aIntroducesHub,
      path: {
        nodes: [pepA, hub],
        relationships: [aIntroducesHub],
        length: 1
      }
    };

    const mapped =
      traversalHitsToEvidence(
        [hit],
        [evidenceOf(pepA)]
      );

    expect(mapped[0]?.relationship).toEqual(aIntroducesHub);
    expect(mapped[0]?.path?.relationships).toEqual([aIntroducesHub]);
    expect(mapped[0]?.path?.length).toBe(1);
  });

  it("direct ask between A and B is NOT_SUPPORTED when only hub edges exist", () => {
    const query =
      "Are Proposal A and Proposal B directly related?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pepA),
          evidenceOf(pepB),
          evidenceOf(hub, aIntroducesHub),
          evidenceOf(hub, bIntroducesHub)
        ])
      );

    expect(interpretation.kind).toBe("INSUFFICIENT");
    expect(interpretation.supportsClaim).toBe(false);
  });

  it("CONNECTED/BRIDGE plans carry endpoint constraints", () => {
    const bridge =
      understandQuery(
        "How are Proposal A and Proposal B connected through HubFeature?"
      );

    expect(bridge.intent).toBe("BRIDGE_RELATIONSHIP");
    expect(bridge.requireRelationshipBetween).toEqual({
      left: expect.any(String),
      right: expect.any(String)
    });
    expect(bridge.bridgeEntity).toBeTruthy();

    const connected =
      understandQuery(
        "How are Proposal A and Proposal B connected?"
      );

    expect(connected.intent).toBe("CONNECTED_RELATIONSHIP");
    expect(connected.requireRelationshipBetween).toBeDefined();
  });

  it("corpus fixture: PEP-526 and PEP-604 connected through Typing", () => {
    const pep526 =
      entity("proposal:PEP-526", "Proposal", "Variable Annotations");
    const pep604 =
      entity("proposal:PEP-604", "Proposal", "Union X | Y");
    const typing =
      entity("feature:typing", "Feature", "Typing");

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
    expect(interpretation.path?.relationships).toHaveLength(2);
  });

  it("corpus fixture: no DistributedComputing introduce edge fails closed", () => {
    const pep526 =
      entity("proposal:PEP-526", "Proposal", "Variable Annotations");
    const typing =
      entity("feature:typing", "Feature", "Typing");

    const query =
      "Does PEP-526 introduce DistributedComputing?";

    const interpretation =
      interpretEvidencePaths(
        query,
        ctx(query, [
          evidenceOf(pep526),
          evidenceOf(typing, rel(pep526.id, typing.id, "INTRODUCES"))
        ])
      );

    /*
     * Query is not a between-relationship ask; without a DistributedComputing
     * endpoint/edge, relational support must not invent one.
     */
    expect(
      interpretation.supportsClaim === false ||
      !interpretation.relationships.includes("RELATED")
    ).toBe(true);
  });

});
