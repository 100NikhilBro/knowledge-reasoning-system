import {
  describe,
  expect,
  it
} from "vitest";

import type {
  EvidenceSet,
  ReasoningPlan,
  ReasoningRequest,
  ReasoningResult
} from "@knowledge/shared";

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

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";


const sampleEvidence: EvidenceSet = {

  evidence: [

    {

      entity: {

        id: "proposal:PEP-484",

        type: "Proposal",

        label: "PEP-484",

        source: "pep-484.md",

        confidence: 1,

        properties: {}

      },

      score: 0.9,

      source: "graph"

    }

  ]

};


class StubCollector
implements EvidenceCollector {

  constructor(
    private readonly evidence: EvidenceSet
  ) {}

  async collect(
    _request: ReasoningRequest
  ): Promise<EvidenceSet> {

    return this.evidence;

  }

}


class StubPlanner
implements ReasoningPlanner {

  async plan(
    _request: ReasoningRequest
  ): Promise<ReasoningPlan> {

    return {
      strategy: "single-hop",
      traversal: "bfs",
      maxDepth: 1
    };

  }

}


class StubReasoner
implements GraphReasoner {

  async reason(
    _plan: ReasoningPlan,
    evidence: EvidenceSet
  ): Promise<EvidenceSet> {

    return evidence;

  }

}


class StubSynthesizer
implements EvidenceSynthesizer {

  async synthesize(
    evidence: EvidenceSet
  ): Promise<EvidenceSet> {

    return evidence;

  }

}


function createEngine(
  evidence: EvidenceSet,
  generator: AnswerGenerator =
    new DefaultAnswerGenerator()
): DefaultReasoningEngine {

  return new DefaultReasoningEngine(

    new StubCollector(evidence),

    new StubPlanner(),

    new StubReasoner(),

    new StubSynthesizer(),

    generator

  );

}


describe(

  "Reasoning result exposure",

  () => {

    it(

      "exposes answer, confidence, citations, and trace",

      async () => {

        const engine =
          createEngine(sampleEvidence);

        const result =
          await engine.reason({

            query: "What is PEP-484?",

            topK: 5

          });

        expect(result.answer)
          .toContain("PEP-484");

        expect(result.confidence)
          .toBe(0.9);

        expect(result.citations)
          .toHaveLength(1);

        expect(result.trace.steps.length)
          .toBeGreaterThan(0);

      }

    );


    it(

      "exposes explanation data when produced",

      async () => {

        const engine =
          createEngine(sampleEvidence);

        const result =
          await engine.reason({

            query: "What is PEP-484?"

          });

        expect(result.explanation)
          .toBeDefined();

        expect(result.explanation?.answer)
          .toBe(result.answer);

        expect(
          result.explanation?.reasoning.length
        ).toBeGreaterThan(0);

        expect(
          result.explanation?.reasoning[0]
        ).toContain("Evidence used: 1");

        expect(
          result.explanation?.reasoning
        ).toContain(
          "Grounded on proposal:PEP-484 from pep-484.md"
        );

      }

    );


    it(

      "preserves citation entity IDs and sources",

      async () => {

        const engine =
          createEngine(sampleEvidence);

        const result =
          await engine.reason({

            query: "What is PEP-484?"

          });

        expect(result.citations[0]).toEqual({

          entityId: "proposal:PEP-484",

          source: "pep-484.md"

        });

      }

    );


    it(

      "returns a safe deterministic result for empty evidence",

      async () => {

        const engine =
          createEngine({ evidence: [] });

        const result =
          await engine.reason({

            query: "unknown topic"

          });

        expect(result).toEqual({

          answer: "",

          confidence: 0,

          citations: [],

          trace: {
            steps: []
          },

          explanation: {

            answer: "",

            reasoning: [

              "Evidence used: 0"

            ]

          }

        } satisfies ReasoningResult);

      }

    );


    it(

      "does not change existing answer generation behavior",

      async () => {

        const generator =
          new DefaultAnswerGenerator();

        const context =
          new DefaultContextBuilder({
            maxEvidence: 20
          }).build(
            sampleEvidence
          );

        const generated =
          await generator.generate(
            context
          );

        const engine =
          createEngine(
            sampleEvidence,
            generator
          );

        const result =
          await engine.reason({

            query: "What is PEP-484?"

          });

        expect(result.answer)
          .toBe(generated.answer);

        expect(result.confidence)
          .toBe(generated.confidence);

        expect(result.citations)
          .toEqual(generated.citations);

        expect(result.trace)
          .toEqual(generated.trace);

        expect(result.comparison)
          .toBe(generated.comparison);

      }

    );

  }

);
