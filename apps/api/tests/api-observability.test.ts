import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  NextFunction,
  Request,
  Response
} from "express";

import request from "supertest";

import type {
  ReasoningEngine
} from "@knowledge/reasoning";

import type {
  ReasoningResult
} from "@knowledge/shared";

import {
  createApp
} from "../src/app.js";

import {
  createTestApp,
  authHeaders,
  TEST_API_KEY,
  testSecurityConfig
} from "./test-helpers.js";

import {
  REQUEST_ID_HEADER,
  isSafeRequestId,
  resolveRequestId,
  createRequestIdMiddleware
} from "../src/middleware/request-id.js";

import {
  sanitizeLogContext,
  type Logger
} from "../src/logging/logger.js";

import {
  API_KEY_HEADER
} from "../src/middleware/api-key-auth.js";


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


class CapturingLogger
  implements Logger {

  readonly entries: Array<{
    level: string;
    message: string;
    context?: Record<string, unknown>;
  }> = [];

  info(
    message: string,
    context?: Record<string, unknown>
  ): void {

    this.entries.push({
      level: "info",
      message,
      context
    });

  }

  warn(
    message: string,
    context?: Record<string, unknown>
  ): void {

    this.entries.push({
      level: "warn",
      message,
      context
    });

  }

  error(
    message: string,
    context?: Record<string, unknown>
  ): void {

    this.entries.push({
      level: "error",
      message,
      context
    });

  }

  serialized(): string {

    return JSON.stringify(this.entries);

  }

}


describe("request ID helpers", () => {

  it("accepts only safe request IDs", () => {

    expect(
      isSafeRequestId("client-req-12345")
    ).toBe(true);

    expect(
      isSafeRequestId("bad id")
    ).toBe(false);

    expect(
      isSafeRequestId("short")
    ).toBe(false);

  });


  it("preserves safe IDs and generates otherwise", () => {

    expect(
      resolveRequestId("client-req-12345")
    ).toBe("client-req-12345");

    const generated =
      resolveRequestId("!!!unsafe!!!");

    expect(isSafeRequestId(generated))
      .toBe(true);

    expect(generated)
      .not.toBe("!!!unsafe!!!");

  });


  it("sets request ID middleware header", () => {

    const middleware =
      createRequestIdMiddleware();

    const req = {

      header(name: string) {

        if (name === REQUEST_ID_HEADER) {
          return "client-req-12345";
        }

        return undefined;

      }

    } as unknown as Request;

    const headers: Record<string, string> = {};

    const res = {

      setHeader(name: string, value: string) {

        headers[name.toLowerCase()] = value;

      }

    } as unknown as Response;

    const next =
      vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(
      (req as { requestId?: string }).requestId
    ).toBe("client-req-12345");

    expect(headers["x-request-id"])
      .toBe("client-req-12345");

    expect(next).toHaveBeenCalledOnce();

  });

});


describe("log sanitization", () => {

  it("redacts secret-like keys and credential-bearing values", () => {

    const sanitized =
      sanitizeLogContext({

        apiKey: TEST_API_KEY,

        authorization:
          `Bearer ${TEST_API_KEY}`,

        requestId: "req-12345678",

        detail:
          "neo4j bolt://secret@host failed"

      });

    expect(sanitized).toEqual({

      apiKey: "[redacted]",

      authorization: "[redacted]",

      requestId: "req-12345678",

      detail: "[redacted]"

    });

  });

});


describe("API observability and security integration", () => {

  it("/health returns 200 without authentication and remains unaffected", async () => {

    const logger =
      new CapturingLogger();

    const response =
      await request(

        createTestApp({
          logger,
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

    expect(response.headers[REQUEST_ID_HEADER])
      .toBeTruthy();

    expect(response.headers["x-content-type-options"])
      .toBe("nosniff");

  });


  it("/reason without API key returns 401 and does not execute reasoning", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const response =
      await request(

        createTestApp({
          reasoningEngine
        })

      )
        .post("/reason")
        .send({
          query: "What is PEP-484?"
        });

    expect(response.status).toBe(401);

    expect(response.body).toEqual({

      error: "Unauthorized",

      code: "UNAUTHORIZED"

    });

    expect(reasoningEngine.reason)
      .not.toHaveBeenCalled();

    expect(response.headers[REQUEST_ID_HEADER])
      .toBeTruthy();

  });


  it("invalid API key returns 401", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const response =
      await request(

        createTestApp({
          reasoningEngine
        })

      )
        .post("/reason")
        .set(API_KEY_HEADER, "wrong-key")
        .send({
          query: "What is PEP-484?"
        });

    expect(response.status).toBe(401);

    expect(reasoningEngine.reason)
      .not.toHaveBeenCalled();

  });


  it("valid API key reaches the reasoning handler with compatible success shape", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => sampleResult)

    };

    const response =
      await request(

        createTestApp({
          reasoningEngine
        })

      )
        .post("/reason")
        .set(authHeaders())
        .send({
          query: "What is PEP-484?",
          topK: 3
        });

    expect(response.status).toBe(200);

    expect(reasoningEngine.reason)
      .toHaveBeenCalledOnce();

    expect(response.body).toEqual({

      answer: sampleResult.answer,

      confidence: sampleResult.confidence,

      citations: sampleResult.citations,

      trace: sampleResult.trace,

      explanation: sampleResult.explanation

    });

  });


  it("rate limit returns 429 and does not execute reasoning beyond the limit", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => sampleResult)

    };

    const app =
      createTestApp({

        securityConfig:
          testSecurityConfig({
            rateLimitMaxRequests: 1,
            rateLimitWindowMs: 60_000
          }),

        reasoningEngine

      });

    await request(app)
      .post("/reason")
      .set(authHeaders())
      .send({
        query: "What is PEP-484?"
      });

    const limited =
      await request(app)
        .post("/reason")
        .set(authHeaders())
        .send({
          query: "What is PEP-484?"
        });

    expect(limited.status).toBe(429);

    expect(limited.body).toEqual({

      error: "Too many requests",

      code: "RATE_LIMITED"

    });

    expect(reasoningEngine.reason)
      .toHaveBeenCalledTimes(1);

  });


  it("invalid requests return 400 and do not execute reasoning", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const response =
      await request(

        createTestApp({
          reasoningEngine
        })

      )
        .post("/reason")
        .set(authHeaders())
        .send({
          query: "   "
        });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({

      error: "Invalid request",

      code: "INVALID_REQUEST"

    });

    expect(reasoningEngine.reason)
      .not.toHaveBeenCalled();

  });


  it("reasoning failure returns sanitized 500 without internal details", async () => {

    const logger =
      new CapturingLogger();

    const response =
      await request(

        createTestApp({

          logger,

          reasoningEngine: {

            reason: vi.fn(async () => {

              throw new Error(
                "neo4j bolt://secret@internal /var/lib/neo4j failed"
              );

            })

          }

        })

      )
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

    const body =
      JSON.stringify(response.body);

    expect(body).not.toContain("secret");

    expect(body).not.toContain("neo4j");

    expect(body).not.toContain("/var/lib");

    expect(body).not.toContain(TEST_API_KEY);

  });


  it("response contains request ID and preserves a safe supplied ID", async () => {

    const response =
      await request(

        createTestApp({

          reasoningEngine: {
            reason: vi.fn(async () => sampleResult)
          }

        })

      )
        .post("/reason")
        .set(authHeaders())
        .set(REQUEST_ID_HEADER, "client-req-abcdef12")
        .send({
          query: "What is PEP-484?"
        });

    expect(response.status).toBe(200);

    expect(response.headers[REQUEST_ID_HEADER])
      .toBe("client-req-abcdef12");

  });


  it("rejects unsafe supplied request IDs by generating a safe replacement", async () => {

    const response =
      await request(

        createTestApp({

          reasoningEngine: {
            reason: vi.fn(async () => sampleResult)
          }

        })

      )
        .post("/reason")
        .set(authHeaders())
        .set(REQUEST_ID_HEADER, "bad id with spaces")
        .send({
          query: "What is PEP-484?"
        });

    expect(response.status).toBe(200);

    expect(
      isSafeRequestId(
        String(response.headers[REQUEST_ID_HEADER])
      )
    ).toBe(true);

    expect(response.headers[REQUEST_ID_HEADER])
      .not.toBe("bad id with spaces");

  });


  it("never logs API keys or Authorization headers", async () => {

    const logger =
      new CapturingLogger();

    await request(

      createTestApp({

        logger,

        reasoningEngine: {
          reason: vi.fn(async () => sampleResult)
        }

      })

    )
      .post("/reason")
      .set(authHeaders())
      .set(
        "Authorization",
        `Bearer ${TEST_API_KEY}`
      )
      .send({
        query: "What is PEP-484?"
      });

    const serialized =
      logger.serialized();

    expect(serialized)
      .not.toContain(TEST_API_KEY);

    expect(serialized.toLowerCase())
      .not.toContain("authorization");

    expect(serialized)
      .not.toContain(`Bearer ${TEST_API_KEY}`);

  });


  it("enforces middleware ordering auth → rate limit → handler", async () => {

    const order: string[] = [];

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

          authenticate: (_req, _res, next) => {

            order.push("auth");

            next();

          },

          rateLimiter: (_req, _res, next) => {

            order.push("rate-limit");

            next();

          },

          reasoningEngine: {

            reason: vi.fn(async () => {

              order.push("reason");

              return sampleResult;

            })

          }

        })

      )
        .post("/reason")
        .send({
          query: "What is PEP-484?"
        });

    expect(response.status).toBe(200);

    expect(order).toEqual([
      "auth",
      "rate-limit",
      "reason"
    ]);

  });

});
