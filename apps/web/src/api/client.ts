import type {
  ApiErrorCode,
  HealthStatus,
  PublicApiError,
  ReasoningRequest,
  ReasoningResult
} from "../types/reasoning";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;

  constructor(
    message: string,
    status: number,
    code: ApiErrorCode | string
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveApiConfig(
  env: ImportMetaEnv = import.meta.env
): ApiClientConfig {
  return {
    baseUrl: trimSlash(env.VITE_API_BASE_URL?.trim() || "/api"),
    apiKey: env.VITE_API_KEY?.trim() || ""
  };
}

function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 400) return "INVALID_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "REASONING_FAILED";
  return "UNKNOWN";
}

function userMessageFor(
  status: number,
  code: string
): string {
  switch (code) {
    case "INVALID_REQUEST":
      return "The query was rejected. Check the request and try again.";
    case "UNAUTHORIZED":
      return "Authentication failed. Set a valid VITE_API_KEY for the web app.";
    case "RATE_LIMITED":
      return "Too many requests. Wait a moment and try again.";
    case "REASONING_FAILED":
      return "Reasoning failed on the server. Try again later.";
    case "NETWORK_ERROR":
      return "Could not reach the API. Confirm the API is running.";
    default:
      return status
        ? `Request failed (${status}).`
        : "Unexpected client error.";
  }
}

async function parseError(
  response: Response
): Promise<ApiClientError> {
  let code: ApiErrorCode | string = mapStatusToCode(response.status);
  let message = userMessageFor(response.status, String(code));

  try {
    const body = (await response.json()) as PublicApiError;
    if (typeof body.code === "string" && body.code.length > 0) {
      code = body.code;
    }
    message = userMessageFor(response.status, String(code));
  } catch {
    // Keep mapped message; never surface raw body text.
  }

  return new ApiClientError(message, response.status, code);
}

export async function checkHealth(
  config: ApiClientConfig
): Promise<HealthStatus> {
  const fetchImpl = config.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${config.baseUrl}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return "down";
    }

    const body = (await response.json()) as { status?: string };
    return body.status === "ok" ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function reason(
  request: ReasoningRequest,
  config: ApiClientConfig,
  signal?: AbortSignal
): Promise<ReasoningResult> {
  const fetchImpl = config.fetchImpl ?? fetch;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (config.apiKey) {
    headers["x-api-key"] = config.apiKey;
  }

  let response: Response;

  try {
    response = await fetchImpl(`${config.baseUrl}/reason`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: request.query,
        ...(request.topK !== undefined ? { topK: request.topK } : {}),
        ...(request.sessionId !== undefined
          ? { sessionId: request.sessionId }
          : {})
      }),
      signal
    });
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new ApiClientError("Request cancelled.", 0, "UNKNOWN");
    }

    throw new ApiClientError(
      userMessageFor(0, "NETWORK_ERROR"),
      0,
      "NETWORK_ERROR"
    );
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as ReasoningResult;
}
