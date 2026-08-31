import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  EvidenceSet,
  ReasoningPlan,
  ReasoningResult
} from "@knowledge/shared";

import {
  DefaultCitationValidator
} from "../src/services/citation-validator.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import {
  DefaultReasoningEngine
} from "../src/services/reasoning-engine.service.js";

import type {
  EvidenceCollector
} from "../src/contracts/evidence-collector.js";

import type {
  ReasoningPlanner
} from "../src/contracts/reasoning-planner.js";

import type {
  GraphReasoner
} from "../src/contracts/graph-reasoner.js";

import type {
  EvidenceSynthesizer
} from "../src/contracts/evidence-synthesizer.js";

import type {
  AnswerGenerator
} from "../src/contracts/answer-generator.js";

import type {
  AnswerVerifier
} from "../src/contracts/answer-verifier.js";

import {
  SingleHopStrategy
} from "../src/strategy/single-hop.strategy.js";

import {
  MultiHopStrategy
} from "../src/strategy/multi-hop.strategy.js";

import {
  ComparisonStrategy
} from "../src/strategy/comparison.strategy.js";

import {
  GraphTraversalService
} from "@knowledge/graph";

import {
  buildAnswerExplanation
} from "../src/utils/build-answer-explanation.js";


function evidence(
  id: string,
  score: number,
  label = id
): EvidenceSet["evidence"][number] {

  return {

    entity: {

      id,

      type: "Proposal",

      label,

      source: `${id}.md`,

      confidence: 1,

      properties: {}

    },

    score,

    source: "graph"

  };

}


function contextFrom(
  items: EvidenceSet["evidence"],
  maxEvidence = 10,
  comparison?: string
) {

  return new DefaultContextBuilder({
    maxEvidence
  }).build({

    evidence: items,

    comparison

  });

}


describe("CitationValidator", () => {

  const validator =
    new DefaultCitationValidator();

  it("accepts valid citations", () => {

    const context =
      contextFrom([
        evidence("proposal:PEP-484", 1, "Type Hints")
      ]);

    const result =
      validator.validate(

        [

          {

            entityId: "proposal:PEP-484",

            source: "proposal:PEP-484.md"

          }

        ],

        context

      );

    expect(result.valid).toHaveLength(1);

    expect(result.rejected).toHaveLength(0);

  });


  it("rejects citation with unknown entityId", () => {

    const context =
      contextFrom([
        evidence("proposal:PEP-484", 1)
      ]);

    const result =
      validator.validate(

        [

          {

            entityId: "proposal:UNKNOWN",

            source: "proposal:PEP-484.md"

          }

        ],

        context

      );

    expect(result.valid).toHaveLength(0);

    expect(result.rejected).toHaveLength(1);

  });


  it("rejects citation with missing source", () => {

    const context =
      contextFrom([
        evidence("proposal:PEP-484", 1)
      ]);

    const result =
      validator.validate(

        [

          {

            entityId: "proposal:PEP-484",

            source: "   "

          }

        ],

        context

      );

    expect(result.valid).toHaveLength(0);

    expect(result.rejected).toHaveLength(1);

  });


  it("rejects citation not present in final context", () => {

    const context =
      contextFrom(
        [
          evidence("kept", 1),
          evidence("dropped", 0.1)
        ],
        1
      );

    expect(
      context.items.map(i => i.entityId)
    ).toEqual(["kept"]);

    const result =
      validator.validate(

        [

          {

            entityId: "dropped",

            source: "dropped.md"

          }

        ],

        context

      );

    expect(result.valid).toHaveLength(0);

    expect(result.rejected).toHaveLength(1);

  });


  it("deduplicates citations deterministically", () => {

    const context =
      contextFrom([
        evidence("a", 1)
      ]);

    const result =
      validator.validate(

        [

          { entityId: "a", source: "a.md" },
          { entityId: "a", source: "a.md" },
          { entityId: "a", source: "a.md" }

        ],

        context

      );

    expect(result.valid).toEqual([

      { entityId: "a", source: "a.md" }

    ]);

    expect(result.rejected).toHaveLength(0);

  });

});


describe("AnswerVerifier", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("keeps confidence and ordering for valid answers", async () => {

    const context =
      contextFrom([
        evidence("high", 0.9, "High"),
        evidence("low", 0.2, "Low")
      ]);

    const generated =
      await new DefaultAnswerGenerator()
        .generate(context);

    const explanation =
      buildAnswerExplanation(
        generated.answer,
        context
      );

    const outcome =
      verifier.verify({

        result: generated,

        context,

        explanation

      });

    expect(outcome.report.accepted)
      .toBe(true);

    expect(outcome.result.confidence)
      .toBe(generated.confidence);

    expect(
      outcome.result.trace.steps.map(
        step => step.evidence[0]?.entity.id
      )
    ).toEqual(["high", "low"]);

    expect(outcome.result.citations)
      .toEqual(generated.citations);

  });


  it("grounds explanation provenance", () => {

    const context =
      contextFrom([
        evidence("proposal:PEP-484", 1, "Type Hints")
      ]);

    const explanation =
      buildAnswerExplanation(
        "Proposal: Type Hints",
        context
      );

    const outcome =
      verifier.verify({

        result: {

          answer: "Proposal: Type Hints",

          confidence: 1,

          citations: [

            {

              entityId: "proposal:PEP-484",

              source: "proposal:PEP-484.md"

            }

          ],

          trace: { steps: [] }

        },

        context,

        explanation

      });

    expect(outcome.report.accepted)
      .toBe(true);

    expect(
      outcome.result.explanation?.reasoning
    ).toContain(
      "Grounded on proposal:PEP-484 from proposal:PEP-484.md"
    );

  });


  it("rejects ungrounded explanation provenance", () => {

    const context =
      contextFrom([
        evidence("a", 1)
      ]);

    const outcome =
      verifier.verify({

        result: {

          answer: "Proposal: a",

          confidence: 1,

          citations: [

            { entityId: "a", source: "a.md" }

          ],

          trace: { steps: [] }

        },

        context,

        explanation: {

          answer: "Proposal: a",

          reasoning: [

            "Evidence used: 1",

            "Grounded on forged:id from forged.md"

          ]

        }

      });

    expect(outcome.report.accepted)
      .toBe(false);

    expect(outcome.result.answer)
      .toBe("");

    expect(outcome.result.confidence)
      .toBe(0);

  });


  it("returns safe empty behavior without supporting evidence", () => {

    const context =
      contextFrom([]);

    const outcome =
      verifier.verify({

        result: {

          answer: "Invented claim",

          confidence: 0.99,

          citations: [

            {

              entityId: "fake",

              source: "fake.md"

            }

          ],

          trace: { steps: [] }

        },

        context

      });

    expect(outcome.report.accepted)
      .toBe(false);

    expect(outcome.result).toMatchObject({

      answer: "",

      confidence: 0,

      citations: [],

      trace: { steps: [] }

    });

  });


  it("removes invalid citations without fabricating replacements", () => {

    const context =
      contextFrom([
        evidence("real", 1, "Real")
      ]);

    const outcome =
      verifier.verify({

        result: {

          answer: "Proposal: Real",

          confidence: 1,

          citations: [

            { entityId: "real", source: "real.md" },
            { entityId: "ghost", source: "ghost.md" }

          ],

          trace: { steps: [] }

        },

        context,

        explanation:
          buildAnswerExplanation(
            "Proposal: Real",
            context
          )

      });

    expect(outcome.report.accepted)
      .toBe(true);

    expect(outcome.result.citations).toEqual([

      { entityId: "real", source: "real.md" }

    ]);

    expect(
      outcome.report.rejectedCitations
    ).toHaveLength(1);

  });

});


describe("Reasoning engine final verification integration", () => {

  it("passes final output through answer verification before returning", async () => {

    const verify = vi.fn(
      (input: {
        result: ReasoningResult;
        context: unknown;
        explanation?: unknown;
      }) => ({

        result: {

          ...input.result,

          explanation: {

            answer: input.result.answer,

            reasoning: ["verified"]

          }

        },

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons: []

        }

      })
    );

    const answerVerifier: AnswerVerifier = {
      verify
    };

    const collector: EvidenceCollector = {

      async collect() {

        return {

          evidence: [
            evidence("proposal:PEP-484", 0.9, "Type Hints")
          ]

        };

      }

    };

    const planner: ReasoningPlanner = {

      async plan(): Promise<ReasoningPlan> {

        return {

          strategy: "single-hop",

          traversal: "bfs",

          maxDepth: 1

        };

      }

    };

    const reasoner: GraphReasoner = {

      async reason(_plan, evidence) {

        return evidence;

      }

    };

    const synthesizer: EvidenceSynthesizer = {

      async synthesize(evidence) {

        return evidence;

      }

    };

    const engine =
      new DefaultReasoningEngine(

        collector,
        planner,
        reasoner,
        synthesizer,
        new DefaultAnswerGenerator(),
        undefined,
        new DefaultContextBuilder({
          maxEvidence: 10
        }),
        answerVerifier

      );

    const result =
      await engine.reason({

        query: "What is PEP-484?"

      });

    expect(verify).toHaveBeenCalledOnce();

    expect(result.explanation?.reasoning)
      .toEqual(["verified"]);

    expect(result).not.toHaveProperty(
      "report"
    );

  });


  it("keeps single-hop reasoning working through verification", async () => {

    const strategy =
      new SingleHopStrategy();

    const expanded =
      await strategy.execute(

        new GraphTraversalService(),

        {

          strategy: "single-hop",

          traversal: "bfs",

          maxDepth: 1

        },

        {

          evidence: [
            evidence("pep", 1, "PEP")
          ]

        }

      );

    const context =
      contextFrom(expanded.evidence);

    const generated =
      await new DefaultAnswerGenerator()
        .generate(context);

    const outcome =
      new DefaultAnswerVerifier().verify({

        result: generated,

        context,

        explanation:
          buildAnswerExplanation(
            generated.answer,
            context
          )

      });

    expect(outcome.report.accepted)
      .toBe(true);

    expect(outcome.result.answer)
      .toContain("PEP");

  });


  it("keeps multi-hop reasoning working through verification", async () => {

    const strategy =
      new MultiHopStrategy();

    const graph =
      new GraphTraversalService();

    vi.spyOn(graph, "findNeighbors")
      .mockResolvedValue([]);

    const expanded =
      await strategy.execute(

        graph,

        {

          strategy: "multi-hop",

          traversal: "bfs",

          maxDepth: 2

        },

        {

          evidence: [
            evidence("proposal:PEP-484", 1, "Type Hints")
          ]

        }

      );

    const context =
      contextFrom(expanded.evidence);

    const generated =
      await new DefaultAnswerGenerator()
        .generate(context);

    const outcome =
      new DefaultAnswerVerifier().verify({

        result: generated,

        context,

        explanation:
          buildAnswerExplanation(
            generated.answer,
            context
          )

      });

    expect(outcome.report.accepted)
      .toBe(true);

    expect(outcome.result.confidence)
      .toBeGreaterThanOrEqual(0);

  });


  it("keeps comparison reasoning working through verification", async () => {

    const strategy =
      new ComparisonStrategy();

    const expanded =
      await strategy.execute(

        new GraphTraversalService(),

        {

          strategy: "comparison",

          traversal: "bfs",

          maxDepth: 1

        },

        {

          evidence: [
            evidence("left", 1, "A"),
            evidence("right", 0.9, "B")
          ]

        }

      );

    const context =
      contextFrom(
        expanded.evidence,
        10,
        expanded.comparison
      );

    const generated =
      await new DefaultAnswerGenerator()
        .generate(context);

    const outcome =
      new DefaultAnswerVerifier().verify({

        result: generated,

        context,

        explanation:
          buildAnswerExplanation(
            generated.answer,
            context
          )

      });

    expect(outcome.report.accepted)
      .toBe(true);

    expect(outcome.result.answer)
      .toBe(expanded.comparison);

    expect(outcome.result.comparison)
      .toBe(expanded.comparison);

  });

});
