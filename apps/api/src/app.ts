import express, {
  type Application,
  type RequestHandler
} from "express";

import type {
  ReasoningEngine
} from "@knowledge/reasoning";

import type {
  ReasoningResult
} from "@knowledge/shared";

import {
  validateReasonRequest
} from "./validation/validate-reason-request.js";

import {
  createProductionReasoningEngine
} from "./factories/create-production-reasoning-engine.js";

import {
  createApiErrorHandler
} from "./errors/map-error-to-response.js";

import {
  resolveApiSecurityConfig,
  type ApiSecurityConfig
} from "./config/resolve-api-security-config.js";

import {
  createApiKeyAuthMiddleware
} from "./middleware/api-key-auth.js";

import {
  createRateLimitMiddleware
} from "./middleware/rate-limit.js";

import {
  createRequestIdMiddleware
} from "./middleware/request-id.js";

import {
  createRequestLoggingMiddleware
} from "./middleware/request-logging.js";

import {
  createSecurityHeadersMiddleware
} from "./middleware/security-headers.js";

import {
  ConsoleLogger,
  type Logger
} from "./logging/logger.js";


export interface ApiDependencies {

  reasoningEngine?: ReasoningEngine;

  securityConfig?: ApiSecurityConfig;

  logger?: Logger;

  /**
   * Optional overrides for independently testable middleware.
   */
  authenticate?: RequestHandler;

  rateLimiter?: RequestHandler;

}


function toPublicReasoningResult(
  result: ReasoningResult
): ReasoningResult {

  const confidence =
    typeof result.confidence === "number" &&
    Number.isFinite(result.confidence)
      ? Math.min(1, Math.max(0, result.confidence))
      : 0;

  const response: ReasoningResult = {

    answer:
      result.answer,

    confidence,

    citations:
      result.citations,

    trace:
      result.trace

  };

  if (result.comparison !== undefined) {

    response.comparison =
      result.comparison;

  }

  if (result.explanation !== undefined) {

    response.explanation =
      result.explanation;

  }

  return response;

}


export function createApp(
  dependencies: ApiDependencies = {}
): Application {

  const app: Application =
    express();

  const logger =
    dependencies.logger ??
    new ConsoleLogger();

  const securityConfig =
    dependencies.securityConfig ??
    resolveApiSecurityConfig();

  const authenticate =
    dependencies.authenticate ??
    createApiKeyAuthMiddleware({
      apiKey: securityConfig.apiKey
    });

  const rateLimiter =
    dependencies.rateLimiter ??
    createRateLimitMiddleware({
      windowMs:
        securityConfig.rateLimitWindowMs,
      maxRequests:
        securityConfig.rateLimitMaxRequests
    });

  const reasoningEngine =
    dependencies.reasoningEngine ??
    createProductionReasoningEngine();

  /*
   * Global boundary order:
   * security headers → request id → request logging → JSON
   */
  app.use(
    createSecurityHeadersMiddleware()
  );

  app.use(
    createRequestIdMiddleware()
  );

  app.use(
    createRequestLoggingMiddleware(logger)
  );

  app.use(
    express.json()
  );


  /*
   * CORS:
   * allow the deployed Web UI to call the API.
   *
   * Preflight requests must be handled before the protected
   * /reason route so OPTIONS does not require API authentication.
   */
  app.use((req, res, next) => {

    const origin =
      req.headers.origin;

    const allowedOrigin =
      process.env.WEB_ORIGIN;

    if (
      origin &&
      allowedOrigin &&
      origin === allowedOrigin
    ) {

      res.header(
        "Access-Control-Allow-Origin",
        origin
      );

      res.header(
        "Vary",
        "Origin"
      );

      res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,OPTIONS"
      );

      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, x-api-key"
      );

    }

    if (
      req.method === "OPTIONS"
    ) {

      return res.sendStatus(204);

    }

    next();

  });


  app.get(
    "/health",
    (_, res) => {

      res.json({

        status:
          "ok",

        service:
          "Knowledge Reasoning API"

      });

    }
  );


  /*
   * Protected route ordering:
   * authenticate → rate limit → validation/handler
   */
  app.post(
    "/reason",
    authenticate,
    rateLimiter,
    async (req, res, next) => {

      try {

        const request =
          validateReasonRequest(
            req.body
          );

        const result =
          await reasoningEngine.reason(
            request
          );

        res.json(
          toPublicReasoningResult(result)
        );

      } catch (error) {

        next(error);

      }

    }
  );


  app.use(
    createApiErrorHandler(logger)
  );


  return app;

}
