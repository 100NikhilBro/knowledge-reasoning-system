import type {
  NextFunction,
  Request,
  Response
} from "express";

import {
  LlmError,
  redactLlmErrorText
} from "@knowledge/reasoning";

import {
  ApiError,
  type PublicApiError
} from "./api-error.js";

import type {
  Logger
} from "../logging/logger.js";

import {
  ConsoleLogger
} from "../logging/logger.js";

import type {
  RequestIdRequest
} from "../middleware/request-id.js";

function isMalformedJsonError(
  error: unknown
): boolean {

  if (!(error instanceof SyntaxError)) {
    return false;
  }

  const candidate =
    error as SyntaxError & {
      status?: number;
      statusCode?: number;
      type?: string;
      body?: unknown;
    };

  return (
    candidate.type === "entity.parse.failed" ||
    candidate.status === 400 ||
    candidate.statusCode === 400 ||
    "body" in candidate
  );

}

function isLlmRateLimited(
  error: unknown
): error is LlmError {

  return (
    error instanceof LlmError &&
    error.code === "RATE_LIMITED"
  );

}

/**
 * Map any thrown value to a stable public API error response.
 * Never includes stack traces, secrets, or infrastructure details.
 *
 * Groq/provider 429 → RATE_LIMITED (distinguishable from grounding rejection,
 * which returns HTTP 200 with an empty/partial grounded answer).
 */
export function mapErrorToPublicResponse(
  error: unknown
): {
  statusCode: number;
  body: PublicApiError;
} {

  if (error instanceof ApiError) {

    return {

      statusCode:
        error.statusCode,

      body:
        error.toPublicError()

    };

  }

  if (isMalformedJsonError(error)) {

    const invalid =
      ApiError.invalidRequest();

    return {

      statusCode:
        invalid.statusCode,

      body:
        invalid.toPublicError()

    };

  }

  if (isLlmRateLimited(error)) {

    const limited =
      ApiError.rateLimited(
        "The language model is temporarily rate-limited. Try again shortly."
      );

    return {

      statusCode:
        limited.statusCode,

      body:
        limited.toPublicError()

    };

  }

  const failed =
    ApiError.reasoningFailed();

  return {

    statusCode:
      failed.statusCode,

    body:
      failed.toPublicError()

  };

}

function classifyError(
  error: unknown
): string {

  if (error instanceof ApiError) {
    return error.code;
  }

  if (isMalformedJsonError(error)) {
    return "INVALID_REQUEST";
  }

  if (error instanceof LlmError) {
    return `LlmError:${error.code}`;
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code.length > 0
  ) {
    return (error as { code: string }).code;
  }

  if (error instanceof Error) {
    return error.name || "Error";
  }

  return "UnknownError";

}

function safeErrorMessage(
  error: unknown
): string | undefined {

  if (!(error instanceof Error)) {
    return undefined;
  }

  return redactLlmErrorText(error.message).slice(0, 240);

}

export function createApiErrorHandler(
  logger: Logger = new ConsoleLogger()
) {

  return function apiErrorHandler(

    error: unknown,

    req: Request,

    res: Response,

    _next: NextFunction

  ): void {

    const mapped =
      mapErrorToPublicResponse(error);

    const requestId =
      (req as RequestIdRequest).requestId;

    res.setHeader(
      "x-error-code",
      mapped.body.code
    );

    const errorMessage =
      safeErrorMessage(error);

    /*
     * Rate limits are provider failures but not server crashes —
     * warn-level, with LlmError:RATE_LIMITED class (not grounding).
     */
    if (isLlmRateLimited(error)) {

      logger.warn(
        "http_error",
        {

          requestId,
          statusCode: mapped.statusCode,
          errorCode: mapped.body.code,
          errorClass: classifyError(error),
          ...(errorMessage
            ? { errorMessage }
            : {})

        }
      );

    } else if (
      !(error instanceof ApiError) ||
      error.statusCode >= 500
    ) {

      logger.error(
        "http_error",
        {

          requestId,
          statusCode: mapped.statusCode,
          errorCode: mapped.body.code,
          errorClass: classifyError(error),
          ...(errorMessage
            ? { errorMessage }
            : {})

        }
      );

    } else if (error.statusCode >= 400) {

      logger.warn(
        "http_error",
        {

          requestId,
          statusCode: mapped.statusCode,
          errorCode: mapped.body.code,
          errorClass: classifyError(error)

        }
      );

    }

    res.status(mapped.statusCode)
      .json(mapped.body);

  };

}
