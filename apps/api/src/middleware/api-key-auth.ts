import {
  createHash,
  timingSafeEqual
} from "node:crypto";

import type {
  NextFunction,
  Request,
  Response
} from "express";

import {
  ApiError
} from "../errors/api-error.js";

export const API_KEY_HEADER =
  "x-api-key";

export interface AuthenticatedRequest
  extends Request {

  /**
   * Deterministic non-secret client identity derived from the API key.
   * Used for rate limiting; never the raw key.
   */
  clientId?: string;

}

/**
 * Constant-time string comparison for API keys.
 */
export function timingSafeEqualString(
  left: string,
  right: string
): boolean {

  const leftBuffer =
    Buffer.from(left, "utf8");

  const rightBuffer =
    Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {

    if (rightBuffer.length > 0) {

      timingSafeEqual(
        rightBuffer,
        rightBuffer
      );

    }

    return false;

  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );

}

export function extractApiKey(
  req: Request
): string | undefined {

  const headerValue =
    req.header(API_KEY_HEADER);

  if (
    typeof headerValue === "string" &&
    headerValue.trim().length > 0
  ) {

    return headerValue.trim();

  }

  const authorization =
    req.header("authorization");

  if (
    typeof authorization === "string" &&
    authorization.toLowerCase().startsWith("bearer ")
  ) {

    const token =
      authorization.slice("bearer ".length).trim();

    if (token.length > 0) {
      return token;
    }

  }

  return undefined;

}

export function createClientId(
  apiKey: string
): string {

  return createHash("sha256")
    .update(apiKey, "utf8")
    .digest("hex");

}

export interface ApiKeyAuthOptions {

  apiKey: string;

}

/**
 * API-key authentication middleware for protected routes.
 */
export function createApiKeyAuthMiddleware(
  options: ApiKeyAuthOptions
) {

  const expectedKey =
    options.apiKey;

  return function apiKeyAuthMiddleware(

    req: AuthenticatedRequest,

    _res: Response,

    next: NextFunction

  ): void {

    try {

      if (expectedKey.length === 0) {

        throw ApiError.unauthorized();

      }

      const provided =
        extractApiKey(req);

      if (
        provided === undefined ||
        !timingSafeEqualString(
          provided,
          expectedKey
        )
      ) {

        throw ApiError.unauthorized();

      }

      req.clientId =
        createClientId(provided);

      next();

    } catch (error) {

      next(error);

    }

  };

}
