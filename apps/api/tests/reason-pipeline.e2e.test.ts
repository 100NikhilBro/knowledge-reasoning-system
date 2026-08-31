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


const sampleResult: ReasoningResult = {

  answer: "Proposal: Type Hints",

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
          "Selected Proposal: Type Hints",

        evidence: [

          {

            entity: {

              id: "proposal:PEP-484",

              type: "Proposal",

              label: "Type Hints",

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

    answer: "Proposal: Type Hints",

    reasoning: [

      "Evidence used: 1",

      "Grounded on proposal:PEP-484 from pep-484.md"

    ]

  }

};


const INTERNAL_KEYS = [
  "report",
  "budget",
  "items",
  "config",
  "rejectedCitations",
  "reasons",
  "pipeline",
  "context"
];


describe("API end-to-end reasoning contract", () => {

  it("keeps /health healthy", async () => {

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


  it("accepts the existing /reason request shape and returns public ReasoningResult", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async (req) => {

        expect(req).toEqual({

          query: "What is PEP-484?",

          topK: 3,

          sessionId: "s1"

        });

        return sampleResult;

      })

    };

    const app =
      createTestApp({ reasoningEngine });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({

          query: "What is PEP-484?",

          topK: 3,

          sessionId: "s1"

        });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({

      answer: sampleResult.answer,

      confidence: sampleResult.confidence,

      citations: sampleResult.citations,

      trace: sampleResult.trace,

      explanation: sampleResult.explanation

    });

    for (const key of INTERNAL_KEYS) {

      expect(response.body)
        .not.toHaveProperty(key);

    }

  });


  it("returns 400 for invalid requests", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const app =
      createTestApp({ reasoningEngine });

    const missing =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({});

    expect(missing.status).toBe(400);

    expect(missing.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

    expect(reasoningEngine.reason)
      .not.toHaveBeenCalled();

    const empty =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({ query: "   " });

    expect(empty.status).toBe(400);

    expect(empty.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

  });


  it("keeps existing 500 error behavior for reasoning failures", async () => {

    const errorSpy =
      vi.spyOn(console, "error")
        .mockImplementation(() => undefined);

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => {

        throw new Error(
          "neo4j bolt://secret@host failed"
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

    expect(JSON.stringify(response.body))
      .not.toContain("secret");

    errorSpy.mockRestore();

  });

});
