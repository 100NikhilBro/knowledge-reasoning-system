import type { LlmConfig, LlmProviderKind } from "../types/llm-config.js";

import { LlmError } from "../errors/llm-error.js";

const DEFAULT_GROQ_BASE_URL =
  "https://api.groq.com/openai/v1";

const DEFAULT_GROQ_MODEL =
  "openai/gpt-oss-20b";

const DEFAULT_TIMEOUT_MS =
  30_000;

function parseProvider(
  value: string | undefined
): LlmProviderKind {

  const normalized =
    value?.trim().toLowerCase();

  if (
    !normalized ||
    normalized === "groq"
  ) {
    return "groq";
  }

  if (normalized === "template") {
    return "template";
  }

  throw new LlmError(
    "INVALID_CONFIG",
    `Unsupported LLM_PROVIDER: ${normalized}`
  );

}

function parseTimeoutMs(
  value: string | undefined
): number {

  if (!value?.trim()) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    throw new LlmError(
      "INVALID_CONFIG",
      "GROQ_TIMEOUT_MS must be a positive number"
    );
  }

  return Math.floor(parsed);

}

/**
 * Resolve LLM configuration from environment.
 *
 * GROQ_API_KEY is required when provider=groq.
 * Values are never logged by this function.
 */
export function resolveLlmConfig(
  env: NodeJS.ProcessEnv = process.env
): LlmConfig {

  const provider =
    parseProvider(env.LLM_PROVIDER);

  const apiKey =
    env.GROQ_API_KEY?.trim() ?? "";

  const model =
    env.GROQ_MODEL?.trim() ||
    DEFAULT_GROQ_MODEL;

  const baseUrl =
    (
      env.GROQ_BASE_URL?.trim() ||
      DEFAULT_GROQ_BASE_URL
    ).replace(/\/$/, "");

  const timeoutMs =
    parseTimeoutMs(env.GROQ_TIMEOUT_MS);

  if (
    provider === "groq" &&
    apiKey.length === 0
  ) {
    throw new LlmError(
      "MISSING_API_KEY",
      "GROQ_API_KEY is required when LLM_PROVIDER=groq"
    );
  }

  return {
    provider,
    apiKey,
    model,
    baseUrl,
    timeoutMs
  };

}
