import type {
  NextFunction,
  Request,
  Response
} from "express";

import type {
  Logger
} from "../logging/logger.js";

import type {
  RequestIdRequest
} from "./request-id.js";

export interface RequestLogFields {

  requestId: string;

  method: string;

  route: string;

  statusCode: number;

  durationMs: number;

  errorCode?: string;

}

/**
 * Structured request logging at the API boundary.
 * Does not log headers, bodies, API keys, or reasoning payloads.
 */
export function createRequestLoggingMiddleware(
  logger: Logger
) {

  return function requestLoggingMiddleware(

    req: Request,

    res: Response,

    next: NextFunction

  ): void {

    const startedAt =
      Date.now();

    res.on("finish", () => {

      const request =
        req as RequestIdRequest;

      const route =
        req.route?.path
          ? `${req.baseUrl}${req.route.path}`
          : req.path;

      const fields: RequestLogFields = {

        requestId:
          request.requestId ?? "unknown",

        method:
          req.method,

        route,

        statusCode:
          res.statusCode,

        durationMs:
          Date.now() - startedAt

      };

      const errorCode =
        res.getHeader("x-error-code");

      if (
        typeof errorCode === "string" &&
        errorCode.length > 0
      ) {

        fields.errorCode = errorCode;

      }

      const level =
        res.statusCode >= 500
          ? "error"
          : res.statusCode >= 400
            ? "warn"
            : "info";

      logger[level](
        "http_request",
        {
          ...fields
        }
      );

    });

    next();

  };

}
