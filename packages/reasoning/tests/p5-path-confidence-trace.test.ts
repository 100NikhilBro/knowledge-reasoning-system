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

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

import {
  interpretEvidencePaths,
  interpretGraphPath
} from "../src/utils/interpret-path.js";

import {
  calibrateAnswerConfidence,
  confidenceLevelFromScore
} from "../src/utils/calibrate-confidence.js";

import {
  buildTrace
} from "../src/utils/trace-builder.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

function entity(
  id: string,
  type: string,
  label: string,
  source = "pep-484.md"
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source,
    confidence: 1,
    properties: {}
  };
}

function relationship(
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

function evidence(
  e: KnowledgeEntity,
  score: number,
  rel?: KnowledgeRelationship
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(rel ? { relationship: rel } : {})
  };
}

function contextFromEvidence(
  query: string,
  items: Evidence[]
): ReasoningContext {
  return {
    query,
    evidence: items,
    items: items.map(item => ({
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
      maxEvidence: items.length,
      inputCount: items.length,
      retainedCount: items.length,
      truncated: false
    },
    config: {
      maxEvidence: items.length
    }
  };
}

const pep484 =
  entity("proposal:PEP-484", "Proposal", "Type Hints");

const typing =
  entity("feature:typing", "Feature", "Typing");

const readability =
  entity("concern:readability", "Concern", "Readability");

const introduces =
  relationship("INTRODUCES", pep484.id, typing.id);

const addresses =
  relationship("ADDRESSES", pep484.id, readability.id);

const bridgeEvidence: Evidence[] = [
  evidence(typing, 0.9, introduces),
  evidence(pep484, 0.95, introduces),
  evidence(readability, 0.85, addresses),
  evidence(pep484, 0.9, addresses)
];

describe("P5 path interpretation + confidence + trace", () => {

  it("1. direct relationship — supported", () => {
    const ctx =
      contextFromEvidence(
        "What does PEP-484 introduce?",
        [
          evidence(pep484, 0.9, introduces),
          evidence(typing, 0.9, introduces)
        ]
      );

    const path =
      interpretEvidencePaths(ctx.query, ctx);

    expect(path.kind === "DIRECT" || path.supportsClaim).toBe(true);

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: { evidence: ctx.evidence },
        pathInterpretation: path,
        verificationStatus: "SUPPORTED",
        relationalKind: "full",
        intent: "RELATIONSHIP"
      });

    expect(calibrated.level).not.toBe("NONE");
    expect(calibrated.score).toBeGreaterThan(0);
    expect(
      calibrated.reasons.some(reason =>
        /direct graph relationship|valid graph relationships|verification passed|all requested claims/i
          .test(reason)
      )
    ).toBe(true);
  });

  it("2. bridge relationship — supported", () => {
    const query =
      "How are Typing and Readability connected through PEP-484?";

    const ctx =
      contextFromEvidence(query, bridgeEvidence);

    const path =
      interpretEvidencePaths(query, ctx);

    expect(path.kind).toBe("BRIDGE");
    expect(path.supportsClaim).toBe(true);
    expect(
      path.bridgeEntities.some(item =>
        /pep-?484|type hints/i.test(item)
      )
    ).toBe(true);

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: { evidence: ctx.evidence },
        pathInterpretation: path,
        verificationStatus: "SUPPORTED",
        relationalKind: "full",
        intent: "BRIDGE_RELATIONSHIP"
      });

    expect(["HIGH", "MEDIUM"]).toContain(calibrated.level);
    expect(calibrated.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/bridge/i)
      ])
    );
  });

  it("3. connected relationship — supported", () => {
    const query =
      "How are Typing and Readability connected?";

    const ctx =
      contextFromEvidence(query, bridgeEvidence);

    const path =
      interpretEvidencePaths(query, ctx);

    expect(["CONNECTED", "BRIDGE", "MULTI_HOP"]).toContain(path.kind);
    expect(path.supportsClaim).toBe(true);
  });

  it("4. multi-hop GraphPath interpretation", () => {
    const path =
      interpretGraphPath(
        {
          nodes: [typing, pep484, readability],
          relationships: [introduces, addresses],
          length: 2
        },
        {
          query: "How are Typing and Readability connected?",
          intent: "CONNECTED_RELATIONSHIP"
        }
      );

    expect(["CONNECTED", "MULTI_HOP", "BRIDGE"]).toContain(path.kind);
    expect(path.hopCount).toBe(2);
    expect(path.supportsClaim).toBe(true);
  });

  it("5. direct query with only indirect path → INSUFFICIENT + NONE", () => {
    const query =
      "How is Typing directly related to Readability?";

    const ctx =
      contextFromEvidence(query, bridgeEvidence);

    const path =
      interpretEvidencePaths(query, ctx);

    expect(path.kind).toBe("INSUFFICIENT");
    expect(path.supportsClaim).toBe(false);

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: { evidence: ctx.evidence },
        pathInterpretation: path,
        verificationStatus: "NOT_SUPPORTED",
        relationalKind: "relationship_missing",
        intent: "DIRECT_RELATIONSHIP"
      });

    expect(calibrated.score).toBe(0);
    expect(calibrated.level).toBe("NONE");
  });

  it("6. missing relationship → NONE", () => {
    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [evidence(pep484, 0.9)]
        },
        relationalKind: "relationship_missing",
        verificationStatus: "NOT_SUPPORTED",
        intent: "RELATIONSHIP"
      });

    expect(calibrated.level).toBe("NONE");
    expect(calibrated.score).toBe(0);
  });

  it("7. wrong endpoint path does not support claim", () => {
    const quantum =
      entity("feature:quantum", "Feature", "Quantum Computing");

    const path =
      interpretEvidencePaths(
        "How is Typing directly related to Readability?",
        contextFromEvidence(
          "How is Typing directly related to Readability?",
          [evidence(quantum, 0.8)]
        )
      );

    expect(path.supportsClaim).toBe(false);
    expect(path.kind).toBe("INSUFFICIENT");
  });

  it("8. unsupported implication → NONE", () => {
    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [
            evidence(typing, 0.9, introduces),
            evidence(pep484, 0.9, introduces)
          ]
        },
        implicationSupport: "NOT_SUPPORTED",
        verificationStatus: "NOT_SUPPORTED",
        intent: "IMPLICATION"
      });

    expect(calibrated.level).toBe("NONE");
    expect(calibrated.score).toBe(0);
  });

  it("9. fully supported compound stays above NONE", () => {
    const proposedBy =
      relationship(
        "PROPOSED_BY",
        pep484.id,
        "author:guido"
      );

    const guido =
      entity("author:guido", "Author", "Guido van Rossum");

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [
            evidence(guido, 0.95, proposedBy),
            evidence(typing, 0.9, introduces),
            evidence(readability, 0.9, addresses)
          ]
        },
        verificationStatus: "SUPPORTED",
        relationalKind: "full",
        intent: "COMPOUND"
      });

    expect(calibrated.level).not.toBe("NONE");
    expect(calibrated.score).toBeGreaterThan(0.45);
  });

  it("10. partially supported compound cannot be HIGH", () => {
    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [
            evidence(typing, 0.95, introduces),
            evidence(pep484, 0.95, introduces)
          ]
        },
        verificationStatus: "PARTIALLY_SUPPORTED",
        implicationSupport: "PARTIALLY_SUPPORTED",
        relationalKind: "partial",
        intent: "COMPOUND"
      });

    expect(calibrated.level).not.toBe("HIGH");
    expect(calibrated.score).toBeLessThanOrEqual(0.65);
    expect(calibrated.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unsupported|restricted/i)
      ])
    );
  });

  it("11. strong retrieval + failed verification → NONE", () => {
    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [
            evidence(pep484, 15.5),
            evidence(typing, 12)
          ]
        },
        verificationStatus: "NOT_SUPPORTED",
        exceedsEvidence: true,
        intent: "FACT"
      });

    expect(calibrated.score).toBe(0);
    expect(calibrated.level).toBe("NONE");
  });

  it("12. multi-document fully supported result", () => {
    const pep604 =
      entity("proposal:PEP-604", "Proposal", "Union operators", "pep-604.md");

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [
            evidence(pep484, 0.9, introduces),
            {
              ...evidence(pep604, 0.88),
              metadata: { sources: ["graph", "vector"] }
            }
          ]
        },
        verificationStatus: "SUPPORTED",
        intent: "FACT"
      });

    expect(calibrated.level).not.toBe("NONE");
    expect(calibrated.score).toBeGreaterThan(0);
  });

  it("13. multi-document partially supported result", () => {
    const pep604 =
      entity("proposal:PEP-604", "Proposal", "Union operators", "pep-604.md");

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: {
          evidence: [
            evidence(pep484, 0.9, introduces),
            evidence(pep604, 0.4)
          ]
        },
        verificationStatus: "PARTIALLY_SUPPORTED",
        relationalKind: "partial",
        intent: "COMPOUND"
      });

    expect(calibrated.level).not.toBe("HIGH");
    expect(["LOW", "MEDIUM"]).toContain(calibrated.level);
  });

  it("confidence level bands are deterministic", () => {
    expect(confidenceLevelFromScore(0)).toBe("NONE");
    expect(confidenceLevelFromScore(0.2)).toBe("LOW");
    expect(confidenceLevelFromScore(0.5)).toBe("MEDIUM");
    expect(confidenceLevelFromScore(0.9)).toBe("HIGH");
  });

  it("trace captures intent, path interpretation, confidence", () => {
    const query =
      "How are Typing and Readability connected through PEP-484?";

    const ctx =
      contextFromEvidence(query, bridgeEvidence);

    const path =
      interpretEvidencePaths(query, ctx);

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet: { evidence: ctx.evidence },
        pathInterpretation: path,
        verificationStatus: "SUPPORTED",
        intent: "BRIDGE_RELATIONSHIP"
      });

    const trace =
      buildTrace(
        { evidence: ctx.evidence },
        {
          query,
          context: ctx,
          pathInterpretation: path,
          calibratedConfidence: calibrated,
          verificationStatus: "SUPPORTED"
        }
      );

    expect(trace.meta?.intent).toBeDefined();
    expect(trace.meta?.pathInterpretation?.kind).toBe("BRIDGE");
    expect(trace.meta?.confidence?.level).toBe(calibrated.level);
    expect(
      trace.steps.some(step =>
        /Path interpretation:/i.test(step.description)
      )
    ).toBe(true);
    expect(
      trace.steps.some(step =>
        /Confidence:/i.test(step.description)
      )
    ).toBe(true);
  });

  it("verifier fail-closed for direct query with indirect path", async () => {
    const query =
      "How is Typing directly related to Readability?";

    const ctx =
      contextFromEvidence(query, bridgeEvidence);

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      await verifier.verify({
        result: {
          answer:
            "Typing is directly related to Readability via PEP-484.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context: ctx
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.confidenceLevel).toBe("NONE");
    expect(
      outcome.result.trace.steps.some(step =>
        /Path interpretation: INSUFFICIENT/i.test(step.description)
      )
    ).toBe(true);
    expect(outcome.result.trace.meta?.pathInterpretation?.kind)
      .toBe("INSUFFICIENT");
  });

});
