import type { LlmStructuredGeneration } from "../contracts/llm-provider.js";

import {
  LlmError,
  redactLlmErrorText
} from "../errors/llm-error.js";

function stripMarkdownFence(
  raw: string
): string {

  const trimmed =
    raw.trim();

  const fenced =
    trimmed.match(
      /^```(?:json)?\s*([\s\S]*?)\s*```$/i
    );

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;

}

/**
 * Parse model text into the minimal structured generation result.
 */
export function parseLlmStructuredOutput(
  raw: string
): LlmStructuredGeneration {

  const text =
    stripMarkdownFence(raw);

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new LlmError(
      "MALFORMED_OUTPUT",
      redactLlmErrorText(
        `LLM returned non-JSON output: ${
          error instanceof Error
            ? error.message
            : "parse error"
        }`
      )
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new LlmError(
      "MALFORMED_OUTPUT",
      "LLM structured output must be a JSON object"
    );
  }

  const record =
    parsed as Record<string, unknown>;

  if (typeof record.answer !== "string") {
    throw new LlmError(
      "MALFORMED_OUTPUT",
      "LLM structured output.answer must be a string"
    );
  }

  const result: LlmStructuredGeneration = {
    answer: record.answer.trim()
  };

  if (Array.isArray(record.reasoning)) {
    result.reasoning =
      record.reasoning.filter(
        (line): line is string =>
          typeof line === "string"
      );
  }

  if (Array.isArray(record.citedEntityIds)) {
    result.citedEntityIds =
      record.citedEntityIds.filter(
        (id): id is string =>
          typeof id === "string" &&
          id.trim().length > 0
      );
  }

  return result;

}
