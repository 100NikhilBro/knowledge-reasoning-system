export interface ApiSecurityConfig {

  apiKey: string;

  rateLimitWindowMs: number;

  rateLimitMaxRequests: number;

}

export const DEFAULT_RATE_LIMIT_WINDOW_MS =
  60_000;

export const DEFAULT_RATE_LIMIT_MAX_REQUESTS =
  60;

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  field: string
): number {

  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${field} must be a positive integer`
    );
  }

  return parsed;

}

/**
 * Resolve API authentication and rate-limit configuration.
 *
 * API_KEY=...
 * RATE_LIMIT_WINDOW_MS=60000
 * RATE_LIMIT_MAX_REQUESTS=60
 */
export function resolveApiSecurityConfig(
  env: NodeJS.ProcessEnv = process.env
): ApiSecurityConfig {

  return {

    apiKey:
      env.API_KEY?.trim() ?? "",

    rateLimitWindowMs: parsePositiveInt(
      env.RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
      "RATE_LIMIT_WINDOW_MS"
    ),

    rateLimitMaxRequests: parsePositiveInt(
      env.RATE_LIMIT_MAX_REQUESTS,
      DEFAULT_RATE_LIMIT_MAX_REQUESTS,
      "RATE_LIMIT_MAX_REQUESTS"
    )

  };

}
