export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "REASONING_FAILED";

/**
 * Stable public error body returned by the API.
 */
export interface PublicApiError {

  error: string;

  code: ApiErrorCode;

}

export class ApiError extends Error {

  readonly code: ApiErrorCode;

  readonly statusCode: number;

  constructor(

    code: ApiErrorCode,

    message: string,

    statusCode: number,

    options?: ErrorOptions

  ) {

    super(message, options);

    this.name = "ApiError";

    this.code = code;

    this.statusCode = statusCode;

  }

  static invalidRequest(
    message = "Invalid request"
  ): ApiError {

    return new ApiError(
      "INVALID_REQUEST",
      message,
      400
    );

  }

  static unauthorized(
    message = "Unauthorized"
  ): ApiError {

    return new ApiError(
      "UNAUTHORIZED",
      message,
      401
    );

  }

  static rateLimited(
    message = "Too many requests"
  ): ApiError {

    return new ApiError(
      "RATE_LIMITED",
      message,
      429
    );

  }

  static reasoningFailed(
    message = "Reasoning failed"
  ): ApiError {

    return new ApiError(
      "REASONING_FAILED",
      message,
      500
    );

  }

  toPublicError(): PublicApiError {

    return {

      error: this.message,

      code: this.code

    };

  }

}
