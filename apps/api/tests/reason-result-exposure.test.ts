import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import request from "supertest";

import type {
  ReasoningEngine
} from "@knowledge/reasoning";

import type {
  ReasoningResult
} from "@knowledge/shared";

import {
  createTestApp,
  authHeaders
} from "./test-helpers.js";


const completeResult: ReasoningResult = {

  answer: "Proposal: PEP-484",

  confidence: 0.9,

  citations: [

    {

      entityId: "proposal:PEP-484",

      source: "pep-484.md"

    }

  ],

  trace: {

    steps: [

      {

        description:
          "Selected Proposal: PEP-484",

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

      }

    ]

  },

  explanation: {

    answer: "Proposal: PEP-484",

    reasoning: [

      "Evidence used: 1",

      "Evidence ranked by confidence.",

      "Highest ranked evidence selected."

    ]

  }

};


describe("API /reason result exposure", () => {

  it("returns the complete public reasoning result shape", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => completeResult)

    };

    const app =
      createTestApp({ reasoningEngine });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({
          query: "What is PEP-484?",
          topK: 5
        });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({

      answer: completeResult.answer,

      confidence: completeResult.confidence,

      citations: completeResult.citations,

      trace: completeResult.trace,

      explanation: completeResult.explanation

    });

  });


  it("preserves existing API error behavior", async () => {

    const errorSpy =
      vi.spyOn(console, "error")
        .mockImplementation(() => undefined);

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => {

        throw new Error(
          "neo4j bolt://secret@internal failed"
        );

      })

    };

    const app =
      createTestApp({ reasoningEngine });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({
          query: "What is PEP-484?"
        });

    expect(response.status).toBe(500);

    expect(response.body).toEqual({

      error: "Reasoning failed",

      code: "REASONING_FAILED"

    });

    expect(response.body).not.toHaveProperty(
      "stack"
    );

    expect(JSON.stringify(response.body))
      .not.toContain("secret");

    errorSpy.mockRestore();

  });


  it("keeps /health unchanged", async () => {

    const app =
      createTestApp({

        reasoningEngine: {

          reason: vi.fn()

        }

      });

    const response =
      await request(app).get("/health");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({

      status: "ok",

      service: "Knowledge Reasoning API"

    });

  });


  it("does not expose internal context/budget metadata on /reason", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => completeResult)

    };

    const app =
      createTestApp({ reasoningEngine });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({
          query: "What is PEP-484?"
        });

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty(
      "answer"
    );

    expect(response.body).toHaveProperty(
      "citations"
    );

    expect(response.body).not.toHaveProperty(
      "items"
    );

    expect(response.body).not.toHaveProperty(
      "budget"
    );

    expect(response.body).not.toHaveProperty(
      "config"
    );

    expect(response.body).not.toHaveProperty(
      "evidence"
    );

    expect(response.body).not.toHaveProperty(
      "report"
    );

    expect(response.body).not.toHaveProperty(
      "rejectedCitations"
    );

    expect(response.body).not.toHaveProperty(
      "reasons"
    );

  });

});
