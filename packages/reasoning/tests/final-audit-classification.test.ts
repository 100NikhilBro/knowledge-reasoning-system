import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  buildTrace
} from "../src/utils/trace-builder.js";

import {
  buildRelationalGroundedAnswer
} from "../src/utils/build-partial-grounded-answer.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  entityMatchesPhrase
} from "../src/utils/detect-relationship-between-query.js";

import {
  computeGroundedAnswerConfidence
} from "../src/utils/compute-grounded-confidence.js";

function entity(
  id: string,
  type: string,
  label: string
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "pep-484.md",
    confidence: 1,
    properties: {}
  };
}

function evidenceOf(
  e: KnowledgeEntity,
  relationship?: Evidence["relationship"]
): Evidence {
  return {
    entity: e,
    score: 0.9,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const proposal = entity(
  "proposal:PEP-484",
  "Proposal",
  "Type Hints"
);

const feature = entity(
  "feature:typing",
  "Feature",
  "Typing"
);

const concern = entity(
  "concern:readability",
  "Concern",
  "Readability"
);

const author = entity(
  "author:guido-van-rossum",
  "Author",
  "Guido van Rossum"
);

/**
 * Final-audit classification of known independent issues.
 * These tests document behavior; they do not require cosmetic fixes.
 */
describe("final audit: trace + matching classification", () => {

  it("co-seeded endpoints can duplicate the same edge in the trace (presentation)", () => {
    const introduces = {
      from: "proposal:PEP-484",
      to: "feature:typing",
      type: "INTRODUCES",
      confidence: 1
    } as const;

    const evidence = [
      evidenceOf(proposal, introduces),
      evidenceOf(feature, introduces)
    ];

    const trace =
      buildTrace({ evidence });

    const viaIntroduces =
      trace.steps.filter(step =>
        step.description.includes("INTRODUCES")
      );

    /*
     * Path dedupe: one step for one logical edge, even when both
     * endpoints carry the same relationship attachment.
     */
    expect(viaIntroduces.length).toBe(1);
    expect(viaIntroduces[0]?.description).toMatch(
      /Type Hints via INTRODUCES \(proposal:PEP-484 → feature:typing\)/
    );

    const context =
      new DefaultContextBuilder({ maxEvidence: 20 }).build({
        evidence
      });

    const answer =
      buildRelationalGroundedAnswer(context);

    expect(answer).toBe("Type Hints introduced Typing.");
    expect(
      (answer?.match(/introduced Typing/g) ?? []).length
    ).toBe(1);
  });

  it("entityMatchesPhrase ignores document source and Type Hints≠Typing", () => {
    const sharedSourceEntity =
      entity("feature:typing", "Feature", "Typing");

    /*
     * Source pep-484.md must not make Typing match the phrase PEP-484.
     * Compact substring collision Type Hints ⊃ Typing is also rejected.
     */
    expect(
      entityMatchesPhrase(sharedSourceEntity, "PEP-484")
    ).toBe(false);

    expect(
      entityMatchesPhrase(
        entity("proposal:PEP-484", "Proposal", "Type Hints"),
        "Typing"
      )
    ).toBe(false);

    expect(
      entityMatchesPhrase(sharedSourceEntity, "Typing")
    ).toBe(true);

    expect(
      entityMatchesPhrase(
        entity("proposal:PEP-484", "Proposal", "Type Hints"),
        "PEP-484"
      )
    ).toBe(true);
  });

  it("public confidence stays in [0,1] for co-seeded relational evidence", () => {
    const confidence =
      computeGroundedAnswerConfidence({
        evidence: [
          evidenceOf(proposal, {
            from: "proposal:PEP-484",
            to: "feature:typing",
            type: "INTRODUCES",
            confidence: 1
          }),
          evidenceOf(feature, {
            from: "proposal:PEP-484",
            to: "feature:typing",
            type: "INTRODUCES",
            confidence: 1
          }),
          evidenceOf(concern, {
            from: "proposal:PEP-484",
            to: "concern:readability",
            type: "ADDRESSES",
            confidence: 1
          }),
          evidenceOf(author, {
            from: "proposal:PEP-484",
            to: "author:guido-van-rossum",
            type: "PROPOSED_BY",
            confidence: 1
          })
        ]
      });

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

});
