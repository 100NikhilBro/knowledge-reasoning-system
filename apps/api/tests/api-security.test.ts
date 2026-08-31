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
  createApiKeyAuthMiddleware,
  extractApiKey,
  timingSafeEqualString,
  createClientId,
  API_KEY_HEADER
} from "../src/middleware/api-key-auth.js";

import {
  createRateLimitMiddleware
} from "../src/middleware/rate-limit.js";

import {
  ApiError
} from "../src/errors/api-error.js";


const TEST_API_KEY =
  "test-api-key-not-a-secret-for-ci";

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


function testSecurityConfig(
  overrides: Partial<{
    apiKey: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  }> = {}
) {

  return {

    apiKey: TEST_API_KEY,

    rateLimitWindowMs: 60_000,

    rateLimitMaxRequests: 100,

    ...overrides

  };

}


describe("API key authentication helpers", () => {

  it("compares keys in constant-time fashion", () => {

    expect(
      timingSafeEqualString("abc", "abc")
    ).toBe(true);

    expect(
      timingSafeEqualString("abc", "abd")
    ).toBe(false);

    expect(
      timingSafeEqualString("abc", "ab")
    ).toBe(false);

  });


  it("extracts API keys from headers", () => {

    const fromHeader = {

      header(name: string) {

        if (name === API_KEY_HEADER) {
          return `  ${TEST_API_KEY}  `;
        }

        return undefined;

      }

    } as unknown as Request;

    expect(
      extractApiKey(fromHeader)
    ).toBe(TEST_API_KEY);

    const fromBearer = {

      header(name: string) {

        if (name === "authorization") {
          return `Bearer ${TEST_API_KEY}`;
        }

        return undefined;

      }

    } as unknown as Request;

    expect(
      extractApiKey(fromBearer)
    ).toBe(TEST_API_KEY);

  });


  it("is independently testable as middleware", async () => {

    const middleware =
      createApiKeyAuthMiddleware({
        apiKey: TEST_API_KEY
      });

    const req = {

      header(name: string) {

        if (name === API_KEY_HEADER) {
          return TEST_API_KEY;
        }

        return undefined;

      }

    } as unknown as Request;

    const next =
      vi.fn() as unknown as NextFunction;

    middleware(
      req,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();

    expect(
      (req as { clientId?: string }).clientId
    ).toBe(
      createClientId(TEST_API_KEY)
    );

    const unauthorizedNext =
      vi.fn() as unknown as NextFunction;

    middleware(
      {
        header: () => undefined
      } as unknown as Request,
      {} as Response,
      unauthorizedNext
    );

    expect(unauthorizedNext)
      .toHaveBeenCalledWith(
        expect.any(ApiError)
      );

    expect(
      (unauthorizedNext.mock.calls[0][0] as ApiError).code
    ).toBe("UNAUTHORIZED");

  });

});


describe("API authentication and rate limiting", () => {

  it("/health works without API key", async () => {

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

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


  it("/reason without API key returns 401", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

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

    expect(JSON.stringify(response.body))
      .not.toContain(TEST_API_KEY);

  });


  it("/reason with invalid API key returns 401", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

          reasoningEngine

        })

      )
        .post("/reason")
        .set(API_KEY_HEADER, "wrong-key")
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

  });


  it("/reason with valid API key reaches reasoning pipeline", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => sampleResult)

    };

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

          reasoningEngine

        })

      )
        .post("/reason")
        .set(API_KEY_HEADER, TEST_API_KEY)
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

    expect(JSON.stringify(response.body))
      .not.toContain(TEST_API_KEY);

    expect(response.body)
      .not.toHaveProperty("apiKey");

  });


  it("rate limit allows requests under the configured limit", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => sampleResult)

    };

    const app =
      createApp({

        securityConfig:
          testSecurityConfig({
            rateLimitMaxRequests: 3,
            rateLimitWindowMs: 60_000
          }),

        reasoningEngine

      });

    for (let i = 0; i < 3; i += 1) {

      const response =
        await request(app)
          .post("/reason")
          .set(API_KEY_HEADER, TEST_API_KEY)
          .send({
            query: "What is PEP-484?"
          });

      expect(response.status).toBe(200);

    }

    expect(reasoningEngine.reason)
      .toHaveBeenCalledTimes(3);

  });


  it("rate limit returns 429 after the configured limit", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => sampleResult)

    };

    const app =
      createApp({

        securityConfig:
          testSecurityConfig({
            rateLimitMaxRequests: 2,
            rateLimitWindowMs: 60_000
          }),

        reasoningEngine

      });

    await request(app)
      .post("/reason")
      .set(API_KEY_HEADER, TEST_API_KEY)
      .send({ query: "What is PEP-484?" });

    await request(app)
      .post("/reason")
      .set(API_KEY_HEADER, TEST_API_KEY)
      .send({ query: "What is PEP-484?" });

    const limited =
      await request(app)
        .post("/reason")
        .set(API_KEY_HEADER, TEST_API_KEY)
        .send({ query: "What is PEP-484?" });

    expect(limited.status).toBe(429);

    expect(limited.body).toEqual({

      error: "Too many requests",

      code: "RATE_LIMITED"

    });

    expect(limited.headers["ratelimit-limit"] ||
      limited.headers["RateLimit-Limit"])
      .toBeDefined();

    expect(JSON.stringify(limited.body))
      .not.toContain(TEST_API_KEY);

    expect(limited.body)
      .not.toHaveProperty("store");

    expect(limited.body)
      .not.toHaveProperty("hits");

    expect(reasoningEngine.reason)
      .toHaveBeenCalledTimes(2);

  });


  it("preserves 400 validation after authentication", async () => {

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn()

    };

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

          reasoningEngine

        })

      )
        .post("/reason")
        .set(API_KEY_HEADER, TEST_API_KEY)
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


  it("preserves 500 error contract after authentication", async () => {

    const errorSpy =
      vi.spyOn(console, "error")
        .mockImplementation(() => undefined);

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

          reasoningEngine: {

            reason: vi.fn(async () => {

              throw new Error(
                "neo4j bolt://secret@internal failed"
              );

            })

          }

        })

      )
        .post("/reason")
        .set(API_KEY_HEADER, TEST_API_KEY)
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


  it("enforces middleware ordering authenticate then rate limit", async () => {

    const order: string[] = [];

    const authenticate = (
      _req: Request,
      _res: Response,
      next: NextFunction
    ) => {

      order.push("auth");

      next();

    };

    const rateLimiter = (
      _req: Request,
      _res: Response,
      next: NextFunction
    ) => {

      order.push("rate-limit");

      next();

    };

    const reasoningEngine: ReasoningEngine = {

      reason: vi.fn(async () => {

        order.push("reason");

        return sampleResult;

      })

    };

    const response =
      await request(

        createApp({

          securityConfig:
            testSecurityConfig(),

          authenticate,

          rateLimiter,

          reasoningEngine

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


  it("rate limiter middleware is independently constructible", () => {

    const limiter =
      createRateLimitMiddleware({

        windowMs: 1_000,

        maxRequests: 1

      });

    expect(typeof limiter)
      .toBe("function");

  });

});
