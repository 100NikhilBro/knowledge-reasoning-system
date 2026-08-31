import type {
  ReasoningRequest
} from "@knowledge/shared";

import {
  ApiError
} from "../errors/api-error.js";

/**
 * Maximum accepted topK for POST /reason.
 * Keeps request budgets bounded at the API boundary.
 */
export const REASON_REQUEST_MAX_TOP_K =
  100;

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {

  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );

}

/**
 * Validate POST /reason body into a ReasoningRequest.
 * Independent from the reasoning engine.
 * Does not silently coerce invalid values.
 */
export function validateReasonRequest(
  body: unknown
): ReasoningRequest {

  if (!isPlainObject(body)) {

    throw ApiError.invalidRequest();

  }

  const {
    query,
    topK,
    sessionId
  } = body;

  if (typeof query !== "string") {

    throw ApiError.invalidRequest();

  }

  const trimmedQuery =
    query.trim();

  if (trimmedQuery.length === 0) {

    throw ApiError.invalidRequest();

  }

  const request: ReasoningRequest = {

    query:
      trimmedQuery

  };

  if (topK !== undefined) {

    if (
      typeof topK !== "number" ||
      !Number.isInteger(topK) ||
      topK <= 0 ||
      topK > REASON_REQUEST_MAX_TOP_K
    ) {

      throw ApiError.invalidRequest();

    }

    request.topK = topK;

  }

  if (sessionId !== undefined) {

    if (typeof sessionId !== "string") {

      throw ApiError.invalidRequest();

    }

    const trimmedSessionId =
      sessionId.trim();

    if (trimmedSessionId.length === 0) {

      throw ApiError.invalidRequest();

    }

    request.sessionId =
      trimmedSessionId;

  }

  return request;

}
