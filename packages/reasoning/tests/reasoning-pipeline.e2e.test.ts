import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  Evidence,
  EvidenceSet,
  ReasoningPlan,
  ReasoningRequest,
  ReasoningResult
} from "@knowledge/shared";

import type {
  SessionState
} from "@knowledge/working-memory";

import {
  GraphTraversalService
} from "@knowledge/graph";

import {
  DefaultReasoningEngine
} from "../src/services/reasoning-engine.service.js";

import {
  DefaultReasoningPlanner
} from "../src/services/reasoning-planner.service.js";

import {
  DefaultEvidenceSynthesizer
} from "../src/services/evidence-synthesizer.service.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  ReasoningStrategyFactory
} from "../src/strategy/reasoning-strategy-factory.js";

import {
  SingleHopStrategy
} from "../src/strategy/single-hop.strategy.js";

import {
  MultiHopStrategy
} from "../src/strategy/multi-hop.strategy.js";

import {
  ComparisonStrategy
} from "../src/strategy/comparison.strategy.js";

import type {
  EvidenceCollector
} from "../src/contracts/evidence-collector.js";

import type {
  GraphReasoner
} from "../src/contracts/graph-reasoner.js";

import type {
  SessionStateStore
} from "../src/contracts/session-state-store.js";

import type {
  AnswerGenerator
} from "../src/contracts/answer-generator.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";


const PUBLIC_RESULT_KEYS = new Set([
  "answer",
  "confidence",
  "citations",
  "trace",
  "comparison",
  "explanation"
]);


function makeEvidence(
  id: string,
  label: string,
  score: number,
  type = "Proposal"
): Evidence {

  return {

    entity: {

      id,

      type,

      label,

      source: `${id.replace(/:/g, "-")}.md`,

      confidence: 1,

      properties: {}

    },

    score,

    source: "graph"

  };

}


class FakeSessionStateStore
implements SessionStateStore {

  private readonly states =
    new Map<string, SessionState>();

  async save(
    sessionId: string,
    state: SessionState
  ): Promise<void> {

    this.states.set(sessionId, state);

  }

  async load(
    sessionId: string
  ): Promise<SessionState | null> {

    return this.states.get(sessionId) ?? null;

  }

  async clear(
    sessionId: string
  ): Promise<void> {

    this.states.delete(sessionId);

  }

}


interface PipelineTrace {

  collected?: EvidenceSet;

  plan?: ReasoningPlan;

  expanded?: EvidenceSet;

  synthesized?: EvidenceSet;

  context?: ReasoningContext;

  generated?: ReasoningResult;

  strategyClass?: string;

}


function createPipelineEngine(options: {
  evidence?: Evidence[];
  collect?: EvidenceCollector["collect"];
  reason?: GraphReasoner["reason"];
  generator?: AnswerGenerator;
  sessionStore?: SessionStateStore;
  neighbors?: Map<string, Evidence[]>;
}): {
  engine: DefaultReasoningEngine;
  pipeline: PipelineTrace;
} {

  const pipeline: PipelineTrace = {};

  const neighbors =
    options.neighbors ?? new Map();

  const collector: EvidenceCollector = {

    collect: options.collect ?? (async (request) => {

      pipeline.collected = {

        evidence: options.evidence ?? []

      };

      void request;

      return pipeline.collected;

    })

  };

  const planner =
    new DefaultReasoningPlanner();

  const trackedPlanner = {

    async plan(request: ReasoningRequest) {

      const plan =
        await planner.plan(request);

      pipeline.plan = plan;

      return plan;

    }

  };

  const reasoner: GraphReasoner = {

    reason: options.reason ?? (async (plan, evidence) => {

      const strategy =
        ReasoningStrategyFactory.create(plan);

      pipeline.strategyClass =
        strategy.constructor.name;

      const graph =
        {
          findNeighbors: vi.fn(
            async (
              _type: string,
              entityId: string
            ) => {

              const related =
                neighbors.get(entityId) ?? [];

              return related.map(item => ({

                neighbor: item.entity,

                relationship: {

                  from: entityId,

                  to: item.entity.id,

                  type: "INTRODUCES",

                  confidence: 1

                }

              }));

            }
          )
        } as unknown as GraphTraversalService;

      const expanded =
        await strategy.execute(
          graph,
          plan,
          evidence
        );

      pipeline.expanded = expanded;

      return expanded;

    })

  };

  const synthesizer =
    new DefaultEvidenceSynthesizer();

  const trackedSynthesizer = {

    async synthesize(evidence: EvidenceSet) {

      const synthesized =
        await synthesizer.synthesize(evidence);

      pipeline.synthesized = synthesized;

      return synthesized;

    }

  };

  const contextBuilder =
    new DefaultContextBuilder({
      maxEvidence: 20
    });

  const trackedContextBuilder = {

    build(evidenceSet: EvidenceSet) {

      const context =
        contextBuilder.build(evidenceSet);

      pipeline.context = context;

      return context;

    }

  };

  const generator: AnswerGenerator =
    options.generator ?? {

      async generate(context) {

        const result =
          await new DefaultAnswerGenerator()
            .generate(context);

        pipeline.generated = result;

        return result;

      }

    };

  const engine =
    new DefaultReasoningEngine(

      collector,
      trackedPlanner,
      reasoner,
      trackedSynthesizer,
      generator,
      options.sessionStore,
      trackedContextBuilder,
      new DefaultAnswerVerifier()

    );

  return {
    engine,
    pipeline
  };

}


function assertPublicResult(
  result: ReasoningResult
): void {

  for (const key of Object.keys(result)) {

    expect(PUBLIC_RESULT_KEYS.has(key))
      .toBe(true);

  }

  expect(result).not.toHaveProperty("report");
  expect(result).not.toHaveProperty("budget");
  expect(result).not.toHaveProperty("items");
  expect(result).not.toHaveProperty("config");
  expect(result).not.toHaveProperty("rejectedCitations");

}


describe("End-to-end reasoning pipeline", () => {

  it("completes single-hop reasoning through every stage", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: [pep]
      });

    const result =
      await engine.reason({

        query: "What is PEP-484?",

        topK: 5

      });

    expect(pipeline.plan?.strategy)
      .toBe("single-hop");

    expect(pipeline.strategyClass)
      .toBe(SingleHopStrategy.name);

    expect(pipeline.collected?.evidence)
      .toEqual([pep]);

    expect(pipeline.expanded?.evidence)
      .toEqual([pep]);

    expect(
      pipeline.synthesized?.evidence
        .some(item => item.entity.id === pep.entity.id)
    ).toBe(true);

    expect(
      pipeline.context?.items
        .map(item => item.entityId)
    ).toContain("proposal:PEP-484");

    expect(pipeline.generated?.answer)
      .toContain("Type Hints");

    expect(result.answer)
      .toContain("Type Hints");

    expect(result.citations[0]).toEqual({

      entityId: "proposal:PEP-484",

      source: "proposal-PEP-484.md"

    });

    expect(
      result.explanation?.reasoning
        .some(line =>
          line.includes("proposal:PEP-484")
        )
    ).toBe(true);

    expect(
      result.trace.steps[0]?.evidence[0]?.entity.id
    ).toBe("proposal:PEP-484");

    expect(result.confidence)
      .toBe(pipeline.generated?.confidence);

    assertPublicResult(result);

  });


  it("completes multi-hop reasoning and incorporates traversal evidence", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const feature =
      makeEvidence(
        "feature:typing",
        "Typing",
        0.9,
        "Feature"
      );

    const { engine, pipeline } =
      createPipelineEngine({

        evidence: [pep],

        neighbors: new Map([
          [pep.entity.id, [feature]]
        ])

      });

    const result =
      await engine.reason({

        query:
          "How do PEP-484 and its related entities connect through multiple hops?"

      });

    expect(pipeline.plan?.strategy)
      .toBe("multi-hop");

    expect(pipeline.strategyClass)
      .toBe(MultiHopStrategy.name);

    const expandedIds =
      pipeline.expanded?.evidence
        .map(item => item.entity.id) ?? [];

    expect(expandedIds)
      .toContain("proposal:PEP-484");

    expect(expandedIds)
      .toContain("feature:typing");

    expect(
      pipeline.context?.items
        .map(item => item.entityId)
    ).toEqual(
      expect.arrayContaining([
        "proposal:PEP-484",
        "feature:typing"
      ])
    );

    const featureEvidence =
      pipeline.expanded?.evidence.find(
        item => item.entity.id === "feature:typing"
      );

    expect(featureEvidence?.relationship?.type)
      .toBe("INTRODUCES");
    expect(featureEvidence?.relationship?.type)
      .not.toBe("RELATED");
    expect(featureEvidence?.relationship?.from)
      .toBe("proposal:PEP-484");
    expect(featureEvidence?.relationship?.to)
      .toBe("feature:typing");

    expect(result.citations.map(c => c.entityId))
      .toEqual(
        expect.arrayContaining([
          "proposal:PEP-484",
          "feature:typing"
        ])
      );

    assertPublicResult(result);

  });


  it("completes comparison reasoning", async () => {

    const left =
      makeEvidence("proposal:A", "Alpha", 0.9);

    const right =
      makeEvidence("proposal:B", "Beta", 0.85);

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: [left, right]
      });

    const result =
      await engine.reason({

        query: "Compare proposal A and proposal B"

      });

    expect(pipeline.plan?.strategy)
      .toBe("comparison");

    expect(pipeline.strategyClass)
      .toBe(ComparisonStrategy.name);

    expect(pipeline.expanded?.comparison)
      .toBeDefined();

    expect(pipeline.context?.comparison)
      .toBe(pipeline.expanded?.comparison);

    expect(result.comparison)
      .toBe(pipeline.expanded?.comparison);

    expect(result.answer)
      .toBe(result.comparison);

    assertPublicResult(result);

  });


  it("completes explanation strategy via existing factory mapping", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const feature =
      makeEvidence(
        "feature:typing",
        "Typing",
        0.9,
        "Feature"
      );

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: [pep],
        neighbors: new Map([
          [pep.entity.id, [feature]]
        ])
      });

    const result =
      await engine.reason({

        query: "Why was PEP-484 introduced?"

      });

    expect(pipeline.plan?.strategy)
      .toBe("explanation");

    expect(pipeline.plan?.focusRelationships)
      .toEqual(
        expect.arrayContaining([
          "ADDRESSES",
          "INTRODUCES"
        ])
      );

    // Existing factory maps unsupported explanation to SingleHopStrategy.
    expect(pipeline.strategyClass)
      .toBe(SingleHopStrategy.name);

    expect(result.answer)
      .toContain("Type Hints");

    expect(
      pipeline.expanded?.evidence.some(
        item =>
          item.relationship?.type === "INTRODUCES"
      )
    ).toBe(true);

    expect(
      result.explanation?.reasoning[0]
    ).toContain("Evidence used:");

    assertPublicResult(result);

  });

  it("bounds explanation when focused relationships are missing", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: [pep]
      });

    const result =
      await engine.reason({
        query: "Why was PEP-484 introduced?"
      });

    expect(pipeline.plan?.strategy)
      .toBe("explanation");

    expect(pipeline.expanded?.evidence.map(item => item.entity.id))
      .toEqual(["proposal:PEP-484"]);

    expect(result.answer).toMatch(/Type Hints/i);
    expect(result.answer).toMatch(
      /does not establish the requested relationship/i
    );
    expect(result.confidence).toBe(0);
    expect(
      result.trace.steps.some(step =>
        step.evidence.some(item => item.relationship)
      )
    ).toBe(false);

  });


  it("keeps citations and explanation grounded", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: [pep]
      });

    const result =
      await engine.reason({

        query: "What is PEP-484?"

      });

    for (const citation of result.citations) {

      expect(
        pipeline.context?.items.some(
          item =>
            item.entityId === citation.entityId &&
            item.source === citation.source
        )
      ).toBe(true);

    }

    for (const line of result.explanation?.reasoning ?? []) {

      if (!line.startsWith("Grounded on ")) {
        continue;
      }

      expect(
        pipeline.context?.items.some(
          item =>
            line ===
            `Grounded on ${item.entityId} from ${item.source}`
        )
      ).toBe(true);

    }

  });


  it("keeps trace aligned with grounded evidence order", async () => {

    const high =
      makeEvidence("proposal:high", "High", 0.99);

    const mid =
      makeEvidence("proposal:mid", "Mid", 0.8);

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: [mid, high]
      });

    const result =
      await engine.reason({

        query: "What proposals exist?"

      });

    const contextIds =
      pipeline.context?.evidence
        .map(item => item.entity.id) ?? [];

    const traceIds =
      result.trace.steps.map(
        step => step.evidence[0]?.entity.id
      );

    expect(traceIds).toEqual(contextIds);

  });


  it("propagates confidence consistently through verification", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: [pep]
      });

    const result =
      await engine.reason({

        query: "What is PEP-484?"

      });

    expect(result.confidence)
      .toBe(pipeline.generated?.confidence);

    expect(result.confidence)
      .toBeGreaterThan(0);

  });


  it("returns safe empty result for empty evidence", async () => {

    const { engine, pipeline } =
      createPipelineEngine({
        evidence: []
      });

    const result =
      await engine.reason({

        query: "What is an unknown unsupported topic?"

      });

    expect(pipeline.collected?.evidence)
      .toEqual([]);

    expect(result).toMatchObject({

      answer: "",

      confidence: 0,

      citations: [],

      trace: { steps: [] }

    });

    expect(result.explanation?.reasoning)
      .toContain("Evidence used: 0");

    assertPublicResult(result);

  });


  it("propagates retrieval failures explicitly", async () => {

    const { engine } =
      createPipelineEngine({

        collect: async () => {

          throw new Error(
            "retrieval unavailable"
          );

        }

      });

    await expect(

      engine.reason({

        query: "What is PEP-484?"

      })

    ).rejects.toThrow("retrieval unavailable");

  });


  it("propagates graph traversal failures explicitly", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const { engine } =
      createPipelineEngine({

        evidence: [pep],

        reason: async () => {

          throw new Error(
            "graph traversal failed"
          );

        }

      });

    await expect(

      engine.reason({

        query:
          "Which proposal introduced typing and more?"

      })

    ).rejects.toThrow("graph traversal failed");

  });


  it("replaces ungrounded generation with a grounded partial answer when evidence exists", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const ungroundedGenerator: AnswerGenerator = {

      async generate() {

        return {

          answer: "Fabricated unsupported claim",

          confidence: 0.99,

          citations: [

            {

              entityId: "forged:id",

              source: "forged.md"

            }

          ],

          trace: { steps: [] }

        };

      }

    };

    const { engine } =
      createPipelineEngine({

        evidence: [pep],

        generator: ungroundedGenerator

      });

    const result =
      await engine.reason({

        query: "What is PEP-484?"

      });

    expect(result.answer).toMatch(/Type Hints/i);
    expect(result.answer).toMatch(/proposal/i);
    expect(result.answer).not.toMatch(/Proposal:\s*Type Hints/);
    expect(result.answer).not.toMatch(
      /available evidence does not support additional claims/i
    );
    expect(result.answer).not.toMatch(/Fabricated/i);
    expect(result.citations[0]?.entityId).toBe(
      "proposal:PEP-484"
    );
    expect(result).not.toHaveProperty("report");

    assertPublicResult(result);

  });


  it("preserves working-memory session context across requests", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const store =
      new FakeSessionStateStore();

    const { engine } =
      createPipelineEngine({

        evidence: [pep],

        sessionStore: store

      });

    await engine.reason({

      query: "What is PEP-484?",

      sessionId: "session-e2e"

    });

    await engine.reason({

      query: "Why was PEP-484 introduced?",

      sessionId: "session-e2e"

    });

    const state =
      await store.load("session-e2e");

    expect(state?.history).toEqual([

      {
        query: "What is PEP-484?",
        status: "completed"
      },

      {
        query: "Why was PEP-484 introduced?",
        status: "completed"
      }

    ]);

  });


  it("returns deterministic results for identical requests", async () => {

    const pep =
      makeEvidence(
        "proposal:PEP-484",
        "Type Hints",
        0.95
      );

    const feature =
      makeEvidence(
        "feature:typing",
        "Typing",
        0.9,
        "Feature"
      );

    const build = () =>
      createPipelineEngine({
        evidence: [pep, feature]
      }).engine;

    const request = {

      query: "What is PEP-484?",

      topK: 5

    };

    const first =
      await build().reason(request);

    const second =
      await build().reason(request);

    expect(second).toEqual(first);

  });

});
