import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  executeAnalytical,
  formatAnalyticalAnswer,
  exactObjectMatch
} from "../src/utils/execute-analytical.js";

import {
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

function entity(
  id: string,
  type: string,
  label: string,
  properties: Record<string, unknown> = {},
  source = "pep-484.md"
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source,
    confidence: 1,
    properties
  };
}

function rel(
  type: string,
  from: string,
  to: string
): KnowledgeRelationship {
  return {
    type,
    from,
    to,
    confidence: 1,
    properties: {}
  };
}

function ev(
  e: KnowledgeEntity,
  score: number,
  relationship?: KnowledgeRelationship
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const pep484 = entity("proposal:PEP-484", "Proposal", "Type Hints", { pep: "484" });
const pep526 = entity("proposal:PEP-526", "Proposal", "Variable Annotations", { pep: "526" }, "pep-526.md");
const pep544 = entity("proposal:PEP-544", "Proposal", "Protocols", { pep: "544" }, "pep-544.md");
const pep604 = entity("proposal:PEP-604", "Proposal", "Union X | Y", { pep: "604" }, "pep-604.md");
const typing = entity("feature:typing", "Feature", "Typing", { name: "Typing" });
const readability = entity("concern:readability", "Concern", "Readability", { name: "Readability" });

const intro484 = rel("INTRODUCES", pep484.id, typing.id);
const intro526 = rel("INTRODUCES", pep526.id, typing.id);
const intro544 = rel("INTRODUCES", pep544.id, typing.id);
const intro604 = rel("INTRODUCES", pep604.id, typing.id);
const addresses484 = rel("ADDRESSES", pep484.id, readability.id);

const typingUniverse: Evidence[] = [
  ev(pep484, 0.95, intro484),
  ev(typing, 0.9, intro484),
  ev(pep526, 0.9, intro526),
  ev(typing, 0.85, intro526),
  ev(pep544, 0.8, intro544),
  ev(typing, 0.8, intro544),
  ev(pep604, 0.8, intro604),
  ev(typing, 0.8, intro604),
  ev(readability, 0.7, addresses484),
  ev(pep484, 0.7, addresses484)
];

function ctx(
  query: string,
  evidence: Evidence[]
): ReasoningContext {
  const understanding =
    understandQuery(query);

  const analyticalResult =
    understanding.intent === "ANALYTICAL" &&
    understanding.analytical
      ? executeAnalytical(understanding.analytical, evidence)
      : undefined;

  return {
    query,
    understanding,
    evidence,
    ...(analyticalResult
      ? { analyticalResult }
      : {}),
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
        : {})
    })),
    budget: {
      maxEvidence: evidence.length,
      inputCount: evidence.length,
      retainedCount: evidence.length,
      truncated: false
    }
  };
}

describe("Prompt 2 — analytical predicate binding + complement", () => {

  it("1. COUNT PEPs that introduce Typing", () => {
    const understanding =
      understandQuery("How many PEPs introduce Typing?");

    expect(understanding.intent).toBe("ANALYTICAL");
    expect(understanding.analytical?.filter?.relationshipType).toBe("INTRODUCES");
    expect(understanding.analytical?.filter?.objectPhrase).toBe("Typing");
    expect(understanding.analytical?.filter?.requireObjectMatch).toBe(true);

    const result =
      executeAnalytical(understanding.analytical!, typingUniverse);

    expect(result.status).toBe("SUPPORTED");
    expect(result.value).toBe(4);
    expect(result.requestedTargetEstablished).toBe(true);
    expect(result.deduplicatedEntityIds.sort()).toEqual([
      "proposal:PEP-484",
      "proposal:PEP-526",
      "proposal:PEP-544",
      "proposal:PEP-604"
    ].sort());
  });

  it("2. LIST PEPs that introduce Typing", () => {
    const understanding =
      understandQuery("Which PEPs introduce Typing?");

    expect(understanding.analytical?.operation).toBe("LIST");

    const result =
      executeAnalytical(understanding.analytical!, typingUniverse);

    expect(result.status).toBe("SUPPORTED");
    expect(result.matchedEntities).toHaveLength(4);
    expect(
      result.matchedEntities.every(item =>
        item.relationshipType === "INTRODUCES" &&
        item.objectLabel === "Typing"
      )
    ).toBe(true);
  });

  it("3. COUNT PEPs that introduce DistributedComputing must NOT match Typing", () => {
    const understanding =
      understandQuery(
        "How many PEPs introduce a feature called DistributedComputing, and which?"
      );

    expect(understanding.analytical?.filter?.objectPhrase).toBe(
      "DistributedComputing"
    );
    expect(understanding.analytical?.filter?.requireObjectMatch).toBe(true);

    const result =
      executeAnalytical(understanding.analytical!, typingUniverse);

    expect(result.status).toBe("SUPPORTED");
    expect(result.value).toBe(0);
    expect(result.requestedTargetEstablished).toBe(false);
    expect(result.matchedEntities).toHaveLength(0);
    expect(result.explanation).toMatch(/DistributedComputing/i);
    expect(result.explanation).toMatch(/without broadening|zero matches/i);
  });

  it("4. LIST PEPs that introduce DistributedComputing fails closed", () => {
    const understanding =
      understandQuery(
        "Which PEPs introduce a feature called DistributedComputing?"
      );

    const result =
      executeAnalytical(understanding.analytical!, typingUniverse);

    expect(result.status).toBe("SUPPORTED");
    expect(result.value).toBe(0);
    expect(result.requestedTargetEstablished).toBe(false);
    expect(result.matchedEntities).toHaveLength(0);
  });

  it("5. positive + negative analytical query computes complement from universe", () => {
    const understanding =
      understandQuery(
        "How many PEPs introduce Typing, and which PEPs do not?"
      );

    expect(understanding.analytical?.includeComplement).toBe(true);
    expect(understanding.analytical?.requestedOutputs).toEqual(
      expect.arrayContaining(["count", "complement"])
    );

    const result =
      executeAnalytical(understanding.analytical!, typingUniverse);

    expect(result.status).toBe("SUPPORTED");
    expect(result.value).toBe(4);
    expect(result.universeEntityIds?.sort()).toEqual([
      "proposal:PEP-484",
      "proposal:PEP-526",
      "proposal:PEP-544",
      "proposal:PEP-604"
    ].sort());
    expect(result.nonMatchingEntities).toEqual([]);

    const answer =
      formatAnalyticalAnswer(result);

    expect(answer).toMatch(/Universe:/i);
    expect(answer).toMatch(/Non-matching:/i);
  });

  it("6. negative analytical query fails closed when universe is incomplete", () => {
    const understanding =
      understandQuery(
        "How many PEPs introduce Typing, and which PEPs do not?"
      );

    const result =
      executeAnalytical(understanding.analytical!, [
        ev(typing, 0.9)
      ]);

    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.explanation).toMatch(/universe/i);
  });

  it("7. wrong relationship predicate must not match", () => {
    const understanding =
      understandQuery(
        "How many PEPs address Typing?"
      );

    expect(understanding.analytical?.filter?.relationshipType).toBe(
      "ADDRESSES"
    );

    const result =
      executeAnalytical(understanding.analytical!, typingUniverse);

    /*
     * Typing is a Feature, not a Concern object of ADDRESSES.
     * Either no matches or fail-closed target — never INTRODUCES spillover.
     */
    expect(result.matchedEntities.every(item =>
      item.relationshipType === "ADDRESSES"
    )).toBe(true);
    expect(result.deduplicatedEntityIds).not.toEqual(
      expect.arrayContaining([
        "proposal:PEP-526",
        "proposal:PEP-544",
        "proposal:PEP-604"
      ])
    );
  });

  it("8. wrong target with related lexical content must not match", () => {
    expect(
      exactObjectMatch(typing, "DistributedComputing")
    ).toBe(false);

    expect(
      exactObjectMatch(typing, "Typing")
    ).toBe(true);

    const understanding =
      understandQuery(
        "How many PEPs introduce TypeSystem?"
      );

    const result =
      executeAnalytical(understanding.analytical!, typingUniverse);

    expect(result.status).toBe("SUPPORTED");
    expect(result.value).toBe(0);
    expect(result.requestedTargetEstablished).toBe(false);
    expect(result.matchedEntities).toHaveLength(0);
  });

  it("9. analytical verification rejects result/answer for wrong target", () => {
    const query =
      "How many PEPs introduce a feature called DistributedComputing, and which?";

    const context =
      ctx(query, typingUniverse);

    expect(context.analyticalResult?.value).toBe(0);
    expect(context.analyticalResult?.requestedTargetEstablished).toBe(false);

    const check =
      verifyAnswerAgainstIntent(
        "Count of distinct PEPs in current grounded corpus: 4. Matched canonical IDs: [proposal:PEP-484, proposal:PEP-526, proposal:PEP-544, proposal:PEP-604].",
        context
      );

    expect(check.semantics.status).toBe("NOT_SUPPORTED");
    expect(check.matchesIntent).toBe(false);
  });

  it("10. complement omitted from answer is only partially supported", () => {
    const query =
      "How many PEPs introduce Typing, and which PEPs do not?";

    const context =
      ctx(query, typingUniverse);

    const check =
      verifyAnswerAgainstIntent(
        "Count of distinct PEPs in current grounded corpus: 4. Matched canonical IDs: [proposal:PEP-484, proposal:PEP-526, proposal:PEP-544, proposal:PEP-604].",
        context
      );

    expect(check.semantics.status).toBe("PARTIALLY_SUPPORTED");
    expect(check.matchesIntent).toBe(false);
  });

  it("partial complement universe with one non-matching PEP", () => {
    const understanding =
      understandQuery(
        "How many PEPs introduce Typing, and which PEPs do not?"
      );

    const evidence: Evidence[] = [
      ev(pep484, 0.95, intro484),
      ev(typing, 0.9, intro484),
      ev(pep544, 0.8)
    ];

    const result =
      executeAnalytical(understanding.analytical!, evidence);

    expect(result.value).toBe(1);
    expect(result.nonMatchingEntities?.map(item => item.entityId)).toEqual([
      "proposal:PEP-544"
    ]);
  });

});
