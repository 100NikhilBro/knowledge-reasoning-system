import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  EvidenceSet,
  ReasoningPlan,
  ReasoningRequest
} from "@knowledge/shared";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  resolveReasoningContextConfig
} from "../src/config/resolve-reasoning-context-config.js";

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
  ContextBuilder
} from "../src/contracts/context-builder.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

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


function evidence(
  id: string,
  score: number,
  extras: {
    label?: string;
    relationship?: EvidenceSet["evidence"][number]["relationship"];
  } = {}
): EvidenceSet["evidence"][number] {

  return {

    entity: {

      id,

      type: "Proposal",

      label: extras.label ?? id,

      source: `${id}.md`,

      confidence: 1,

      properties: {}

    },

    score,

    source: "graph",

    relationship:
      extras.relationship

  };

}


describe("Context construction and grounding", () => {

  it("builds context only from verified evidence", () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 10
      });

    const input: EvidenceSet = {

      evidence: [
        evidence("a", 0.9),
        evidence("b", 0.8)
      ]

    };

    const context =
      builder.build(input);

    expect(context.items).toHaveLength(2);

    expect(
      context.items.map(i => i.entityId)
    ).toEqual(["a", "b"]);

    expect(context.evidence).toEqual(
      input.evidence
    );

  });


  it("preserves evidence ordering", () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 10
      });

    const ordered = [
      evidence("high", 0.95),
      evidence("mid", 0.7),
      evidence("low", 0.2)
    ];

    const context =
      builder.build({
        evidence: ordered
      });

    expect(
      context.items.map(i => i.entityId)
    ).toEqual(["high", "mid", "low"]);

    expect(
      context.evidence.map(e => e.score)
    ).toEqual([0.95, 0.7, 0.2]);

  });


  it("enforces context budget and keeps highest-ranked first", () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 2
      });

    const context =
      builder.build({

        evidence: [
          evidence("first", 1.0),
          evidence("second", 0.9),
          evidence("third", 0.8),
          evidence("fourth", 0.1)
        ]

      });

    expect(context.evidence).toHaveLength(2);

    expect(
      context.items.map(i => i.entityId)
    ).toEqual(["first", "second"]);

    expect(context.budget).toEqual({

      maxEvidence: 2,

      inputCount: 4,

      retainedCount: 2,

      truncated: true

    });

  });


  it("preserves provenance and citations through context construction", async () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 5
      });

    const context =
      builder.build({

        evidence: [
          evidence("proposal:PEP-484", 0.9, {
            label: "Type Hints"
          })
        ]

      });

    expect(context.items[0]).toMatchObject({

      entityId: "proposal:PEP-484",

      entityType: "Proposal",

      source: "proposal:PEP-484.md",

      confidence: 1,

      score: 0.9,

      evidenceSource: "graph"

    });

    const result =
      await new DefaultAnswerGenerator()
        .generate(context);

    expect(result.citations).toEqual([

      {

        entityId: "proposal:PEP-484",

        source: "proposal:PEP-484.md"

      }

    ]);

  });


  it("includes relationship data only when already present", () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 5
      });

    const relationship = {

      from: "proposal:PEP-484",

      to: "feature:typing",

      type: "INTRODUCES",

      confidence: 0.95

    };

    const context =
      builder.build({

        evidence: [
          evidence("proposal:PEP-484", 1, {
            relationship
          }),
          evidence("feature:typing", 0.8)
        ]

      });

    expect(
      context.items[0].relationship
    ).toEqual(relationship);

    expect(
      context.items[1].relationship
    ).toBeUndefined();

  });


  it("produces safe empty context without inventing evidence", () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 5
      });

    const context =
      builder.build({
        evidence: []
      });

    expect(context.items).toEqual([]);

    expect(context.evidence).toEqual([]);

    expect(context.comparison)
      .toBeUndefined();

    expect(context.budget.truncated)
      .toBe(false);

    expect(context.budget.retainedCount)
      .toBe(0);

  });


  it("does not add unsupported information", () => {

    const builder =
      new DefaultContextBuilder({
        maxEvidence: 5
      });

    const context =
      builder.build({

        evidence: [
          evidence("only-entity", 0.5)
        ]

      });

    const item =
      context.items[0];

    expect(item).not.toHaveProperty(
      "fabricated"
    );

    expect(Object.keys(item).sort())
      .toEqual([
        "confidence",
        "entityId",
        "entityType",
        "evidenceSource",
        "label",
        "score",
        "source"
      ]);

  });


  it("passes constructed context into answer generation", async () => {

    const captured: ReasoningContext[] = [];

    const generator: AnswerGenerator = {

      async generate(context) {

        captured.push(context);

        return {

          answer: "ok",

          confidence: 0,

          citations: [],

          trace: { steps: [] }

        };

      }

    };

    const contextBuilder: ContextBuilder = {

      build(evidenceSet) {

        return new DefaultContextBuilder({
          maxEvidence: 1
        }).build(evidenceSet);

      }

    };

    const collector: EvidenceCollector = {

      async collect() {

        return {

          evidence: [
            evidence("a", 1),
            evidence("b", 0.5)
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
        generator,
        undefined,
        contextBuilder

      );

    await engine.reason({

      query: "test"

    });

    expect(captured).toHaveLength(1);

    expect(captured[0].evidence)
      .toHaveLength(1);

    expect(captured[0].items[0].entityId)
      .toBe("a");

  });


  it("resolves context budget from configuration", () => {

    const config =
      resolveReasoningContextConfig({

        REASONING_CONTEXT_MAX_EVIDENCE:
          "7"

      });

    expect(config.maxEvidence).toBe(7);

  });


  it("keeps single-hop reasoning working", async () => {

    const strategy =
      new SingleHopStrategy();

    const input = {

      evidence: [evidence("pep", 1)]

    };

    const result =
      await strategy.execute(

        new GraphTraversalService(),

        {

          strategy: "single-hop",

          traversal: "bfs",

          maxDepth: 1

        },

        input

      );

    const context =
      new DefaultContextBuilder({
        maxEvidence: 10
      }).build(result);

    const answer =
      await new DefaultAnswerGenerator()
        .generate(context);

    expect(answer.answer)
      .toContain("pep");

    expect(answer.citations[0].entityId)
      .toBe("pep");

  });


  it("keeps multi-hop reasoning working", async () => {

    const strategy =
      new MultiHopStrategy();

    const graph =
      new GraphTraversalService();

    vi.spyOn(graph, "findNeighbors")
      .mockResolvedValue([]);

    const input = {

      evidence: [
        evidence("proposal:PEP-484", 1, {
          label: "Type Hints"
        })
      ]

    };

    const result =
      await strategy.execute(

        graph,

        {

          strategy: "multi-hop",

          traversal: "bfs",

          maxDepth: 2

        },

        input

      );

    const context =
      new DefaultContextBuilder({
        maxEvidence: 10
      }).build(result);

    const answer =
      await new DefaultAnswerGenerator()
        .generate(context);

    expect(answer.confidence)
      .toBeGreaterThanOrEqual(0);

    expect(Array.isArray(answer.citations))
      .toBe(true);

  });


  it("keeps comparison reasoning working", async () => {

    const strategy =
      new ComparisonStrategy();

    const input = {

      evidence: [
        evidence("left", 1, { label: "A" }),
        evidence("right", 0.9, { label: "B" })
      ]

    };

    const result =
      await strategy.execute(

        new GraphTraversalService(),

        {

          strategy: "comparison",

          traversal: "bfs",

          maxDepth: 1

        },

        input

      );

    expect(result.comparison)
      .toBeDefined();

    const context =
      new DefaultContextBuilder({
        maxEvidence: 10
      }).build(result);

    expect(context.comparison)
      .toBe(result.comparison);

    const answer =
      await new DefaultAnswerGenerator()
        .generate(context);

    expect(answer.answer)
      .toBe(result.comparison);

    expect(answer.comparison)
      .toBe(result.comparison);

  });

});
