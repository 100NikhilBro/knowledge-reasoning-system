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
  detectComparisonRequest,
  extractComparisonSubjects,
  detectComparisonDimensions
} from "../src/utils/detect-comparison-request.js";

import {
  buildStructuredComparison
} from "../src/utils/compare-evidence.js";

import {
  ComparisonStrategy
} from "../src/strategy/comparison.strategy.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  DefaultReasoningPlanner
} from "../src/services/reasoning-planner.service.js";

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

function shuffle<T>(
  items: T[]
): T[] {
  const copy =
    [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j =
      (i * 7 + 3) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
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
        : {})
    })),
    budget: {
      maxEvidence: 50,
      inputCount: evidence.length,
      retainedCount: evidence.length,
      truncated: false
    },
    config: {
      maxEvidence: 50
    },
    comparison: undefined
  };
}

describe("Prompt 4 query-driven comparison", () => {

  const A =
    entity("proposal:a", "Proposal", "EntityA");
  const B =
    entity("proposal:b", "Proposal", "EntityB");
  const C =
    entity("proposal:c", "Proposal", "EntityC");
  const D =
    entity("proposal:d", "Proposal", "EntityD");
  const unrelated =
    entity("proposal:z", "Proposal", "UnrelatedZ");
  const featX =
    entity("feature:x", "Feature", "FeatureX");
  const featY =
    entity("feature:y", "Feature", "FeatureY");
  const featZ =
    entity("feature:z", "Feature", "FeatureZ");
  const authorP =
    entity("author:p", "Author", "AuthorP");
  const authorQ =
    entity("author:q", "Author", "AuthorQ");
  const decisionF =
    entity("decision:f", "Decision", "Final");

  const aIntroX =
    rel(A.id, featX.id, "INTRODUCES");
  const aIntroY =
    rel(A.id, featY.id, "INTRODUCES");
  const bIntroX =
    rel(B.id, featX.id, "INTRODUCES");
  const bIntroZ =
    rel(B.id, featZ.id, "INTRODUCES");
  const aProposed =
    rel(A.id, authorP.id, "PROPOSED_BY");
  const bProposed =
    rel(B.id, authorQ.id, "PROPOSED_BY");
  const aDecision =
    rel(A.id, decisionF.id, "RESULTS_IN");
  const cIntroX =
    rel(C.id, featX.id, "INTRODUCES");
  const dIntroY =
    rel(D.id, featY.id, "INTRODUCES");

  it("1: two-way comparison A vs B", () => {
    const query =
      "Compare EntityA and EntityB based only on relationships.";

    const request =
      detectComparisonRequest(query, ["EntityA", "EntityB"]);

    expect(request?.subjects).toEqual(["EntityA", "EntityB"]);

    const result =
      buildStructuredComparison(
        request!,
        [
          evidenceOf(A, aIntroX),
          evidenceOf(B, bIntroZ),
          evidenceOf(featX),
          evidenceOf(featZ)
        ]
      );

    expect(result.perSubject).toHaveLength(2);
    expect(result.perSubject[0]?.supported).toBe(true);
    expect(result.perSubject[1]?.supported).toBe(true);
  });

  it("2: N-way comparison A, B, C, D", () => {
    const query =
      "Compare EntityA, EntityB, EntityC, and EntityD based only on relationships.";

    const subjects =
      extractComparisonSubjects(query, [
        "EntityA",
        "EntityB",
        "EntityC",
        "EntityD"
      ]);

    expect(subjects).toEqual([
      "EntityA",
      "EntityB",
      "EntityC",
      "EntityD"
    ]);

    const result =
      buildStructuredComparison(
        {
          subjects,
          dimensions: ["relationships"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(B, bIntroX),
          evidenceOf(C, cIntroX),
          evidenceOf(D, dIntroY)
        ]
      );

    expect(result.subjects).toHaveLength(4);
    expect(result.perSubject).toHaveLength(4);
  });

  it("3: explicit subject extraction", () => {
    const understanding =
      understandQuery(
        "Compare EntityA vs EntityB based only on relationships."
      );

    expect(understanding.intent).toBe("COMPARISON");
    expect(understanding.comparison?.subjects).toEqual([
      "EntityA",
      "EntityB"
    ]);
  });

  it("4: comparison dimensions extraction", () => {
    expect(
      detectComparisonDimensions(
        "Compare A and B based only on relationships."
      ).dimensions
    ).toEqual(["relationships"]);

    expect(
      detectComparisonDimensions(
        "Compare A and B based on introduced features and proposers."
      ).dimensions
    ).toEqual(
      expect.arrayContaining(["introduces", "proposed_by"])
    );

    expect(
      detectComparisonDimensions(
        "Compare A, B based on relationships and decisions."
      ).dimensions
    ).toEqual(["results_in"]);
  });

  it("5: relationship-only comparison", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["relationships"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(A, aProposed),
          evidenceOf(B, bIntroX),
          evidenceOf(unrelated)
        ]
      );

    expect(
      result.perSubject.some(item =>
        item.entityId === unrelated.id
      )
    ).toBe(false);

    expect(result.common.map(fact => fact.key)).toContain(
      `INTRODUCES|${featX.id}|outgoing`
    );
  });

  it("6: relationship + proposer comparison", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["introduces", "proposed_by"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(A, aProposed),
          evidenceOf(B, bIntroX),
          evidenceOf(B, bProposed),
          evidenceOf(A, aDecision)
        ]
      );

    expect(
      result.perSubject[0]?.relationships.every(fact =>
        fact.type === "INTRODUCES" ||
        fact.type === "PROPOSED_BY"
      )
    ).toBe(true);

    expect(
      result.perSubject.some(item =>
        item.relationships.some(fact =>
          fact.type === "RESULTS_IN"
        )
      )
    ).toBe(false);
  });

  it("7: common relationship target", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["relationships"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(A, aIntroY),
          evidenceOf(B, bIntroX),
          evidenceOf(B, bIntroZ)
        ]
      );

    expect(result.common.map(fact => fact.targetId)).toContain(featX.id);
    expect(result.common.map(fact => fact.targetId)).not.toContain(featY.id);
  });

  it("8: subject-specific relationship", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["relationships"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(A, aIntroY),
          evidenceOf(B, bIntroX)
        ]
      );

    const aOnly =
      result.differences.find(item => item.subject === "EntityA");

    expect(aOnly?.facts.map(fact => fact.targetId)).toContain(featY.id);
  });

  it("9: missing evidence for one subject", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["relationships"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(B)
        ]
      );

    expect(result.perSubject[0]?.supported).toBe(true);
    expect(result.perSubject[1]?.supported).toBe(false);
    expect(result.unsupportedSubjects).toContain("EntityB");
    expect(
      result.perSubject[1]?.relationships
    ).toEqual([]);
  });

  it("10: unrequested retrieved entity must not become comparison subject", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["relationships"],
          relationshipsOnly: true
        },
        [
          evidenceOf(unrelated, rel(unrelated.id, featX.id, "INTRODUCES")),
          evidenceOf(A, aIntroX),
          evidenceOf(B, bIntroX)
        ]
      );

    expect(result.subjects).toEqual(["EntityA", "EntityB"]);
    expect(
      result.perSubject.map(item => item.subject)
    ).toEqual(["EntityA", "EntityB"]);
  });

  it("11+12: retrieval/evidence order permutation does not change result", () => {
    const request = {
      subjects: ["EntityA", "EntityB", "EntityC"],
      dimensions: ["relationships" as const],
      relationshipsOnly: true
    };

    const base = [
      evidenceOf(A, aIntroX),
      evidenceOf(B, bIntroZ),
      evidenceOf(C, cIntroX),
      evidenceOf(unrelated),
      evidenceOf(featX),
      evidenceOf(featZ)
    ];

    const first =
      buildStructuredComparison(request, base);

    const second =
      buildStructuredComparison(request, shuffle(base));

    const third =
      buildStructuredComparison(request, shuffle(shuffle(base)));

    expect(second.common.map(fact => fact.key).sort()).toEqual(
      first.common.map(fact => fact.key).sort()
    );
    expect(third.common.map(fact => fact.key).sort()).toEqual(
      first.common.map(fact => fact.key).sort()
    );

    expect(
      second.perSubject.map(item => ({
        subject: item.subject,
        keys: item.relationships.map(fact => fact.key).sort()
      }))
    ).toEqual(
      first.perSubject.map(item => ({
        subject: item.subject,
        keys: item.relationships.map(fact => fact.key).sort()
      }))
    );
  });

  it("13: wrong subject evidence rejected", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["relationships"],
          relationshipsOnly: true
        },
        [
          evidenceOf(unrelated, rel(unrelated.id, featX.id, "INTRODUCES")),
          evidenceOf(B, bIntroX)
        ]
      );

    expect(result.perSubject[0]?.supported).toBe(false);
    expect(
      result.perSubject[0]?.relationships
    ).toEqual([]);
  });

  it("14: wrong relationship target rejected for subject binding", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["introduces"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(B, bIntroZ)
        ]
      );

    expect(
      result.common.some(fact =>
        fact.targetId === featX.id &&
        fact.type === "INTRODUCES"
      )
    ).toBe(false);
  });

  it("15: wrong relationship direction rejected for commonality", () => {
    const reverse =
      rel(featX.id, A.id, "INTRODUCES");

    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["introduces"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, reverse),
          evidenceOf(B, bIntroX)
        ]
      );

    expect(result.common).toHaveLength(0);
    expect(
      result.perSubject[0]?.relationships[0]?.direction
    ).toBe("incoming");
    expect(
      result.perSubject[1]?.relationships[0]?.direction
    ).toBe("outgoing");
  });

  it("16: unsupported comparison dimension", () => {
    const result =
      buildStructuredComparison(
        {
          subjects: ["EntityA", "EntityB"],
          dimensions: ["proposed_by"],
          relationshipsOnly: true
        },
        [
          evidenceOf(A, aIntroX),
          evidenceOf(B, bIntroX)
        ]
      );

    expect(result.unsupportedSubjects).toEqual([
      "EntityA",
      "EntityB"
    ]);
  });

  it("17: current PEP comparison regression", async () => {
    const pep484 =
      entity("proposal:PEP-484", "Proposal", "Type Hints");
    const pep526 =
      entity(
        "proposal:PEP-526",
        "Proposal",
        "Variable Annotations"
      );
    const pep544 =
      entity("proposal:PEP-544", "Proposal", "Protocols");
    const pep604 =
      entity("proposal:PEP-604", "Proposal", "Union X | Y");
    const typing =
      entity("feature:typing", "Feature", "Typing");
    const guido =
      entity("author:guido", "Author", "Guido van Rossum");

    const query =
      "Compare PEP-484, PEP-526, PEP-544, PEP-604 based only on relationships; what each introduces, who proposed it, decision?";

    const understanding =
      understandQuery(query);

    expect(understanding.comparison?.subjects).toEqual([
      "PEP-484",
      "PEP-526",
      "PEP-544",
      "PEP-604"
    ]);

    expect(understanding.comparison?.dimensions).toEqual(
      expect.arrayContaining([
        "introduces",
        "proposed_by",
        "results_in"
      ])
    );

    const plan =
      await new DefaultReasoningPlanner().plan({ query });

    expect(plan.comparison?.subjects).toEqual([
      "PEP-484",
      "PEP-526",
      "PEP-544",
      "PEP-604"
    ]);

    const graph = {
      findNeighbors: async (_type: string, id: string) => {
        if (id === pep484.id) {
          return [
            {
              neighbor: typing,
              relationship: rel(pep484.id, typing.id, "INTRODUCES")
            },
            {
              neighbor: guido,
              relationship: rel(pep484.id, guido.id, "PROPOSED_BY")
            }
          ];
        }

        if (id === pep526.id) {
          return [
            {
              neighbor: typing,
              relationship: rel(pep526.id, typing.id, "INTRODUCES")
            }
          ];
        }

        return [];
      }
    };

    const expanded =
      await new ComparisonStrategy().execute(
        graph as never,
        plan,
        {
          evidence: [
            evidenceOf(pep604),
            evidenceOf(pep484),
            evidenceOf(unrelated),
            evidenceOf(pep544),
            evidenceOf(pep526)
          ]
        }
      );

    expect(expanded.comparison).toBeTruthy();
    expect(expanded.comparison).toMatch(/PEP-484/i);
    expect(expanded.comparison).toMatch(/PEP-526/i);
    expect(expanded.comparison).not.toMatch(/UnrelatedZ/i);

    const structured =
      buildStructuredComparison(
        plan.comparison!,
        expanded.evidence
      );

    expect(structured.subjects).toHaveLength(4);
    expect(
      structured.perSubject.map(item => item.subject)
    ).toEqual([
      "PEP-484",
      "PEP-526",
      "PEP-544",
      "PEP-604"
    ]);
  });

  it("strategy ignores retrieval order for subjects", async () => {
    const query =
      "Compare EntityA and EntityB based only on relationships.";

    const plan =
      await new DefaultReasoningPlanner().plan({ query });

    const graph = {
      findNeighbors: async (_type: string, id: string) => {
        if (id === A.id) {
          return [
            {
              neighbor: featX,
              relationship: aIntroX
            }
          ];
        }

        if (id === B.id) {
          return [
            {
              neighbor: featZ,
              relationship: bIntroZ
            }
          ];
        }

        return [];
      }
    };

    const first =
      await new ComparisonStrategy().execute(
        graph as never,
        plan,
        {
          evidence: [
            evidenceOf(unrelated),
            evidenceOf(B),
            evidenceOf(A)
          ]
        }
      );

    const second =
      await new ComparisonStrategy().execute(
        graph as never,
        plan,
        {
          evidence: [
            evidenceOf(A),
            evidenceOf(unrelated),
            evidenceOf(B)
          ]
        }
      );

    expect(first.comparison).toBe(second.comparison);
  });

  it("verification rejects answer that invents another subject's edge", () => {
    const query =
      "Compare EntityA and EntityB based only on relationships.";

    const evidence = [
      evidenceOf(A, aIntroX),
      evidenceOf(B, bIntroZ),
      evidenceOf(featX),
      evidenceOf(featZ)
    ];

    const context =
      ctx(query, evidence);

    const structured =
      buildStructuredComparison(
        context.understanding!.comparison!,
        evidence
      );

    context.comparison =
      [
        "Comparison of EntityA, EntityB (relationships):",
        "EntityA: introduces FeatureX.",
        "EntityB: introduces FeatureZ."
      ].join("\n");

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      verifier.verify({
        result: {
          answer:
            "EntityB introduces FeatureX. EntityA introduces FeatureZ.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    /*
     * Deterministic comparison context replaces invented generator prose.
     */
    expect(outcome.result.comparison ?? outcome.result.answer)
      .toMatch(/EntityA/i);
    expect(
      structured.perSubject.find(item => item.subject === "EntityB")
        ?.relationships.some(fact => fact.targetId === featX.id)
    ).toBe(false);
  });

});
