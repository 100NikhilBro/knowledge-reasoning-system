import rateLimit, {
  type Options,
  type RateLimitRequestHandler
} from "express-rate-limit";

import type {
  NextFunction,
  Request,
  Response
} from "express";

import {
  ApiError
} from "../errors/api-error.js";

import type {
  AuthenticatedRequest
} from "./api-key-auth.js";

export interface RateLimitMiddlewareOptions {

  windowMs: number;

  maxRequests: number;

  /**
   * Optional override for tests / future Redis stores.
   */
  store?: Options["store"];

}

function resolveClientIdentity(
  req: Request
): string {

  const authenticated =
    req as AuthenticatedRequest;

  if (
    typeof authenticated.clientId === "string" &&
    authenticated.clientId.length > 0
  ) {

    return `key:${authenticated.clientId}`;

  }

  return `ip:${req.ip || "unknown"}`;

}

/**
 * In-memory rate limiter for protected routes.
 * Not a distributed limiter — replace store for Redis later.
 */
export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions
): RateLimitRequestHandler {

  return rateLimit({

    windowMs:
      options.windowMs,

    limit:
      options.maxRequests,

    standardHeaders: true,

    legacyHeaders: false,

    keyGenerator:
      resolveClientIdentity,

    store:
      options.store,

    // In-process limiter; disable proxy / IPv6 keyGenerator checks for local/dev.
    validate: {
      xForwardedForHeader: false,
      ip: false,
      keyGeneratorIpFallback: false
    },

    handler(
      _req: Request,
      _res: Response,
      next: NextFunction
    ) {

      next(
        ApiError.rateLimited()
      );

    }

  });

}
