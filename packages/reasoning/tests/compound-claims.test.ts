import {
  describe,
  expect,
  it
} from "vitest";

import type { Evidence } from "@knowledge/shared";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  extractLogicalClaims,
  splitIndependentClaimClauses,
  evaluateLogicalImplication,
  evaluateClaimsAgainstEvidence
} from "../src/utils/logical-implication.js";

import {
  classifyQueryIntent,
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

function evidence(
  id: string,
  type: string,
  label: string,
  relationship?: Evidence["relationship"],
  properties: Record<string, unknown> = {},
  source = "pep-484.md"
): Evidence {
  return {
    entity: {
      id,
      type,
      label,
      source,
      confidence: 1,
      properties
    },
    score: 0.9,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const introduces484 = {
  from: "proposal:PEP-484",
  to: "feature:typing",
  type: "INTRODUCES",
  confidence: 1
} as const;

const introduces526 = {
  from: "proposal:PEP-526",
  to: "feature:typing",
  type: "INTRODUCES",
  confidence: 1
} as const;

const addresses484 = {
  from: "proposal:PEP-484",
  to: "concern:readability",
  type: "ADDRESSES",
  confidence: 1
} as const;

const proposedBy484 = {
  from: "proposal:PEP-484",
  to: "author:guido-van-rossum",
  type: "PROPOSED_BY",
  confidence: 1
} as const;

const proposedBy526 = {
  from: "proposal:PEP-526",
  to: "author:ryan-gonzalez",
  type: "PROPOSED_BY",
  confidence: 1
} as const;

function contextFor(
  query: string,
  items: Evidence[]
) {
  const context =
    new DefaultContextBuilder({ maxEvidence: 20 }).build({
      evidence: items
    });
  context.query = query;
  context.understanding = understandQuery(query);
  return context;
}

const pep484Graph = [
  evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces484, { pep: "484" }),
  evidence("feature:typing", "Feature", "Typing", introduces484),
  evidence("proposal:PEP-484", "Proposal", "Type Hints", addresses484, { pep: "484" }),
  evidence("concern:readability", "Concern", "Readability", addresses484),
  evidence("proposal:PEP-484", "Proposal", "Type Hints", proposedBy484, { pep: "484" }),
  evidence("author:guido-van-rossum", "Author", "Guido van Rossum", proposedBy484)
];

const multiPepGraph = [
  ...pep484Graph,
  evidence(
    "proposal:PEP-526",
    "Proposal",
    "Syntax for Variable Annotations",
    introduces526,
    { pep: "526" },
    "pep-526.md"
  ),
  evidence(
    "feature:typing",
    "Feature",
    "Typing",
    introduces526,
    {},
    "pep-526.md"
  ),
  evidence(
    "proposal:PEP-526",
    "Proposal",
    "Syntax for Variable Annotations",
    proposedBy526,
    { pep: "526" },
    "pep-526.md"
  ),
  evidence(
    "author:ryan-gonzalez",
    "Author",
    "Ryan Gonzalez",
    proposedBy526,
    {},
    "pep-526.md"
  ),
  evidence(
    "proposal:PEP-544",
    "Proposal",
    "Protocols",
    {
      from: "proposal:PEP-544",
      to: "feature:typing",
      type: "INTRODUCES",
      confidence: 1
    },
    { pep: "544" },
    "pep-544.md"
  ),
  evidence(
    "proposal:PEP-604",
    "Proposal",
    "Union types as X | Y",
    {
      from: "proposal:PEP-604",
      to: "feature:typing",
      type: "INTRODUCES",
      confidence: 1
    },
    { pep: "604" },
    "pep-604.md"
  )
];

describe("compound logical claim decomposition (Prompt 1)", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("1. two independent implication claims are extracted and evaluated", () => {

    const query =
      "Can we conclude that PEP-484 introduced Typing and that Typing improves runtime performance?";

    const claims =
      extractLogicalClaims(query);

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subject: "PEP-484",
          predicate: "INTRODUCES",
          object: "Typing",
          inferenceMode: "typed_edge"
        }),
        expect.objectContaining({
          subject: "Typing",
          predicate: "IMPROVES",
          object: "runtime performance",
          inferenceMode: "causal_extra"
        })
      ])
    );

    const decision =
      evaluateLogicalImplication(
        query,
        contextFor(query, pep484Graph)
      );

    expect(decision.support).toBe("PARTIALLY_SUPPORTED");
    expect(
      decision.claims.filter(item => item.support === "SUPPORTED")
    ).toHaveLength(1);
    expect(
      decision.claims.filter(item => item.support === "NOT_SUPPORTED")
    ).toHaveLength(1);

  });

  it("2. supported + unsupported implication claims → PARTIALLY_SUPPORTED", () => {

    const query =
      "Did PEP-484 introduce the Typing feature, and did it directly cause PEP-526?";

    expect(classifyQueryIntent(query)).toBe("COMPOUND");

    const understanding =
      understandQuery(query);

    expect(understanding.claims).toEqual([
      expect.objectContaining({
        subject: "PEP-484",
        predicate: "INTRODUCES",
        object: "Typing",
        inferenceMode: "typed_edge"
      }),
      expect.objectContaining({
        subject: "PEP-484",
        predicate: "CAUSAL",
        object: "PEP-526",
        inferenceMode: "causal_extra"
      })
    ]);

    const decision =
      evaluateClaimsAgainstEvidence(
        understanding.claims,
        contextFor(query, multiPepGraph)
      );

    expect(decision.support).toBe("PARTIALLY_SUPPORTED");
    expect(decision.established).toContain("INTRODUCES");
    expect(decision.missing).toContain("CAUSAL");

    const check =
      verifyAnswerAgainstIntent(
        "PEP-484 introduced Typing and also caused PEP-526.",
        contextFor(query, multiPepGraph)
      );

    expect(check.semantics.status).toBe("PARTIALLY_SUPPORTED");
    expect(check.matchesIntent).toBe(false);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "PEP-484 introduced Typing and directly caused PEP-526.",
          confidence: 1,
          citations: [],
          trace: { steps: [] }
        },
        context: contextFor(query, multiPepGraph)
      });

    expect(outcome.result.confidence).toBeLessThan(1);
    expect(outcome.result.answer).not.toMatch(
      /directly caused PEP-526/i
    );

  });

  it("3. compound non-implication requests stay tied to the same subject", () => {

    const query =
      "Who proposed PEP-484, what did it introduce, and what concern did it address?";

    expect(splitIndependentClaimClauses(query)).toEqual([
      "Who proposed PEP-484",
      "what did it introduce",
      "what concern did it address?"
    ]);

    const understanding =
      understandQuery(query);

    expect(understanding.intent).toBe("COMPOUND");
    expect(understanding.claims).toHaveLength(3);
    expect(understanding.claims.every(claim =>
      claim.subject === "PEP-484"
    )).toBe(true);
    expect(understanding.claims.map(claim => claim.predicate)).toEqual([
      "PROPOSED_BY",
      "INTRODUCES",
      "ADDRESSES"
    ]);
    expect(understanding.rewrittenRepresentation).toMatch(
      /PEP-484 → PROPOSED_BY/
    );
    expect(understanding.rewrittenRepresentation).toMatch(
      /PEP-484 → INTRODUCES/
    );
    expect(understanding.rewrittenRepresentation).toMatch(
      /PEP-484 → ADDRESSES/
    );

  });

  it("4. unrelated entity spillover cannot satisfy another claim", () => {

    const query =
      "Who proposed PEP-484, what did it introduce, and what concern did it address?";

    const context =
      contextFor(query, multiPepGraph);

    const decision =
      evaluateClaimsAgainstEvidence(
        context.understanding!.claims,
        context
      );

    expect(decision.support).toBe("SUPPORTED");
    expect(
      decision.claims.every(item =>
        item.claim.subject === "PEP-484" &&
        item.support === "SUPPORTED"
      )
    ).toBe(true);

    const spilloverAnswer =
      "Ryan Gonzalez proposed PEP-526, which introduced Typing. Protocols also introduced Typing.";

    const check =
      verifyAnswerAgainstIntent(
        spilloverAnswer,
        context
      );

    expect(check.semantics.status).not.toBe("SUPPORTED");
    expect(
      check.semantics.claims.some(claim =>
        claim.predicate === "PROPOSED_BY" &&
        claim.status !== "SUPPORTED"
      )
    ).toBe(true);

  });

  it("5. malformed/ambiguous conjunctions fail closed rather than invent structure", () => {

    expect(
      splitIndependentClaimClauses("Typing and Readability")
    ).toEqual(["Typing and Readability"]);

    expect(
      extractLogicalClaims("Typing and Readability")
    ).toEqual([]);

    const understanding =
      understandQuery("Typing and Readability");

    expect(understanding.intent).toBe("FACT");
    expect(understanding.claims).toEqual([]);

  });

  it("6. production causal chronology compound stays unsupported", () => {

    const query =
      "Did PEP-526 cause PEP-604, and was PEP-604 introduced after PEP-526?";

    const understanding =
      understandQuery(query);

    expect(understanding.intent).toBe("COMPOUND");
    expect(understanding.claims).toEqual([
      expect.objectContaining({
        subject: "PEP-526",
        predicate: "CAUSAL",
        object: "PEP-604",
        inferenceMode: "causal_extra"
      }),
      expect.objectContaining({
        subject: "PEP-604",
        predicate: "AFTER",
        object: "PEP-526",
        inferenceMode: "causal_extra"
      })
    ]);

    const decision =
      evaluateClaimsAgainstEvidence(
        understanding.claims,
        contextFor(query, multiPepGraph)
      );

    expect(decision.support).toBe("NOT_SUPPORTED");
    expect(decision.claims).toHaveLength(2);
    expect(
      decision.claims.every(item => item.support === "NOT_SUPPORTED")
    ).toBe(true);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "Yes, PEP-526 caused PEP-604 and PEP-604 was introduced after PEP-526.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context: contextFor(query, multiPepGraph)
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(/does not establish/i);

  });

});
