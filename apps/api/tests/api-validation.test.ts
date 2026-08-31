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

import {
  validateReasonRequest,
  REASON_REQUEST_MAX_TOP_K
} from "../src/validation/validate-reason-request.js";

import {
  ApiError
} from "../src/errors/api-error.js";

import {
  mapErrorToPublicResponse
} from "../src/errors/map-error-to-response.js";


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

    steps: []

  },

  explanation: {

    answer: "Proposal: Type Hints",

    reasoning: [

      "Evidence used: 1"

    ]

  }

};


describe("validateReasonRequest", () => {

  it("accepts a valid request shape", () => {

    expect(

      validateReasonRequest({

        query: "  What is PEP-484?  ",

        topK: 5,

        sessionId: " session-1 "

      })

    ).toEqual({

      query: "What is PEP-484?",

      topK: 5,

      sessionId: "session-1"

    });

  });


  it("rejects missing or blank query", () => {

    expect(() =>
      validateReasonRequest({})
    ).toThrow(ApiError);

    expect(() =>
      validateReasonRequest({
        query: "   "
      })
    ).toThrow(ApiError);

  });


  it("rejects invalid topK without coercion", () => {

    expect(() =>
      validateReasonRequest({
        query: "What is PEP-484?",
        topK: "3"
      })
    ).toThrow(ApiError);

    expect(() =>
      validateReasonRequest({
        query: "What is PEP-484?",
        topK: 0
      })
    ).toThrow(ApiError);

    expect(() =>
      validateReasonRequest({
        query: "What is PEP-484?",
        topK: 1.5
      })
    ).toThrow(ApiError);

    expect(() =>
      validateReasonRequest({
        query: "What is PEP-484?",
        topK: REASON_REQUEST_MAX_TOP_K + 1
      })
    ).toThrow(ApiError);

  });


  it("rejects invalid sessionId without coercion", () => {

    expect(() =>
      validateReasonRequest({
        query: "What is PEP-484?",
        sessionId: 12
      })
    ).toThrow(ApiError);

    expect(() =>
      validateReasonRequest({
        query: "What is PEP-484?",
        sessionId: "   "
      })
    ).toThrow(ApiError);

  });

});


describe("mapErrorToPublicResponse", () => {

  it("maps ApiError and unknown failures stably", () => {

    expect(
      mapErrorToPublicResponse(
        ApiError.invalidRequest()
      )
    ).toEqual({

      statusCode: 400,

      body: {

        error: "Invalid request",

        code: "INVALID_REQUEST"

      }

    });

    expect(
      mapErrorToPublicResponse(
        new Error("neo4j bolt://secret@host")
      )
    ).toEqual({

      statusCode: 500,

      body: {

        error: "Reasoning failed",

        code: "REASONING_FAILED"

      }

    });

  });

  it("maps LlmError RATE_LIMITED to a safe public 429", async () => {

    const { LlmError } =
      await import("@knowledge/reasoning");

    expect(
      mapErrorToPublicResponse(
        new LlmError(
          "RATE_LIMITED",
          "LLM provider HTTP 429: Rate limit reached Bearer gsk_secret"
        )
      )
    ).toEqual({

      statusCode: 429,

      body: {

        error:
          "The language model is temporarily rate-limited. Try again shortly.",

        code: "RATE_LIMITED"

      }

    });

    const mapped =
      mapErrorToPublicResponse(
        new LlmError(
          "RATE_LIMITED",
          "LLM provider HTTP 429: Rate limit reached Bearer gsk_secret"
        )
      );

    expect(JSON.stringify(mapped.body)).not.toMatch(/gsk_/);
    expect(JSON.stringify(mapped.body)).not.toMatch(/Bearer/);

  });

  it("maps other LlmError codes to REASONING_FAILED without exposing details", async () => {

    const { LlmError } =
      await import("@knowledge/reasoning");

    expect(
      mapErrorToPublicResponse(
        new LlmError(
          "PROVIDER_FAILURE",
          "LLM provider HTTP 500: internal"
        )
      )
    ).toEqual({

      statusCode: 500,

      body: {

        error: "Reasoning failed",

        code: "REASONING_FAILED"

      }

    });

  });

});


describe("API request validation and error contract", () => {

  it("valid request succeeds with unchanged success shape", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => sampleResult)

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

    expect(response.body)
      .not.toHaveProperty("code");

  });


  it("missing query returns 400", async () => {

    const app =
      createTestApp({

        reasoningEngine: {
          reason: vi.fn()
        }

      });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({});

    expect(response.status).toBe(400);

    expect(response.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

  });


  it("blank query returns 400", async () => {

    const app =
      createTestApp({

        reasoningEngine: {
          reason: vi.fn()
        }

      });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({ query: "   " });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

  });


  it("invalid topK returns 400", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const app =
      createTestApp({ reasoningEngine });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({

          query: "What is PEP-484?",

          topK: -1

        });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

    expect(reasoningEngine.reason)
      .not.toHaveBeenCalled();

  });


  it("invalid sessionId returns 400", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const app =
      createTestApp({ reasoningEngine });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({

          query: "What is PEP-484?",

          sessionId: ""

        });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

    expect(reasoningEngine.reason)
      .not.toHaveBeenCalled();

  });


  it("malformed JSON returns 400", async () => {

    const app =
      createTestApp({

        reasoningEngine: {
          reason: vi.fn()
        }

      });

    const response =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .set("Content-Type", "application/json")
        .send("{ not-json");

    expect(response.status).toBe(400);

    expect(response.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

  });


  it("application failure returns stable 500 without leaking details", async () => {

    const errorSpy =
      vi.spyOn(console, "error")
        .mockImplementation(() => undefined);

    const app =
      createTestApp({

        reasoningEngine: {

          reason: vi.fn(async () => {

            throw new Error(
              "neo4j bolt://secret@internal failed"
            );

          })

        }

      });

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

    expect(response.body)
      .not.toHaveProperty("stack");

    expect(JSON.stringify(response.body))
      .not.toContain("secret");

    expect(JSON.stringify(response.body))
      .not.toContain("neo4j");

    errorSpy.mockRestore();

  });


  it("/health remains 200", async () => {

    const response =
      await request(

        createTestApp({

          reasoningEngine: {
            reason: vi.fn()
          }

        })

      ).get("/health");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({

      status: "ok",

      service: "Knowledge Reasoning API"

    });

  });

});
