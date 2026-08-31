import {
  randomUUID
} from "node:crypto";

import type {
  NextFunction,
  Request,
  Response
} from "express";

export const REQUEST_ID_HEADER =
  "x-request-id";

/**
 * Safe incoming request IDs:
 * alphanumeric, underscore, hyphen; length 8–128.
 */
const SAFE_REQUEST_ID =
  /^[A-Za-z0-9_-]{8,128}$/;

export interface RequestIdRequest
  extends Request {

  requestId?: string;

}

export function isSafeRequestId(
  value: string
): boolean {

  return SAFE_REQUEST_ID.test(value);

}

export function resolveRequestId(
  incoming: string | undefined
): string {

  if (
    typeof incoming === "string" &&
    isSafeRequestId(incoming.trim())
  ) {

    return incoming.trim();

  }

  return randomUUID();

}

/**
 * Assigns a correlation/request ID and echoes it on the response.
 */
export function createRequestIdMiddleware() {

  return function requestIdMiddleware(

    req: RequestIdRequest,

    res: Response,

    next: NextFunction

  ): void {

    const incoming =
      req.header(REQUEST_ID_HEADER) ??
      req.header("x-correlation-id");

    const requestId =
      resolveRequestId(
        typeof incoming === "string"
          ? incoming
          : undefined
      );

    req.requestId = requestId;

    res.setHeader(
      REQUEST_ID_HEADER,
      requestId
    );

    next();

  };

}
