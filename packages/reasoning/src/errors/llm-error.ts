export class LlmError extends Error {

  readonly code: string;

  constructor(
    code: string,
    message: string,
    options?: ErrorOptions
  ) {

    super(message, options);

    this.name = "LlmError";
    this.code = code;

  }

}

/**
 * Strip secrets / auth material from error text before surfacing or logging.
 */
export function redactLlmErrorText(
  value: string
): string {

  return value
    .replace(
      /Bearer\s+[A-Za-z0-9._-]+/gi,
      "Bearer [REDACTED]"
    )
    .replace(
      /api[_-]?key["'\s:=]+[A-Za-z0-9._-]+/gi,
      "api_key=[REDACTED]"
    )
    .replace(
      /gsk_[A-Za-z0-9]+/g,
      "[REDACTED_GROQ_KEY]"
    )
    .replace(
      /jina_[A-Za-z0-9]+/gi,
      "[REDACTED_EMBEDDING_KEY]"
    )
    .replace(
      /\bsk-[A-Za-z0-9]{16,}\b/g,
      "[REDACTED_API_KEY]"
    )
    .replace(
      /Authorization["'\s:]+[^\s,"']+/gi,
      "Authorization=[REDACTED]"
    )
    .replace(
      /password["'\s:=]+[^\s,"']+/gi,
      "password=[REDACTED]"
    );

}
