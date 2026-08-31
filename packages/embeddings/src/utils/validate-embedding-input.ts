import { EmbeddingError } from "../errors/embedding-error.js";

const DEFAULT_MAX_BATCH_SIZE = 64;

export function assertNonEmptyTexts(
  texts: string[],
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE
): string[] {

  if (!Array.isArray(texts)) {
    throw new EmbeddingError(
      "INVALID_INPUT",
      "texts must be an array of strings"
    );
  }

  if (texts.length === 0) {
    throw new EmbeddingError(
      "INVALID_INPUT",
      "texts must contain at least one string"
    );
  }

  if (texts.length > maxBatchSize) {
    throw new EmbeddingError(
      "BATCH_TOO_LARGE",
      `texts length ${texts.length} exceeds maxBatchSize ${maxBatchSize}`
    );
  }

  const normalized: string[] = [];

  for (let index = 0; index < texts.length; index++) {

    const text = texts[index];

    if (typeof text !== "string") {
      throw new EmbeddingError(
        "INVALID_INPUT",
        `texts[${index}] must be a string`
      );
    }

    const trimmed = text.trim();

    if (trimmed.length === 0) {
      throw new EmbeddingError(
        "INVALID_INPUT",
        `texts[${index}] must be a non-empty string`
      );
    }

    normalized.push(trimmed);

  }

  return normalized;

}

export function assertNonEmptyText(
  text: string
): string {

  if (typeof text !== "string") {
    throw new EmbeddingError(
      "INVALID_INPUT",
      "text must be a string"
    );
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    throw new EmbeddingError(
      "INVALID_INPUT",
      "text must be a non-empty string"
    );
  }

  return trimmed;

}

export function assertVectorDimensions(
  vectors: readonly (readonly number[])[],
  dimensions: number
): void {

  for (let index = 0; index < vectors.length; index++) {

    const vector = vectors[index];

    if (!Array.isArray(vector)) {
      throw new EmbeddingError(
        "INVALID_VECTOR",
        `vector[${index}] must be an array`
      );
    }

    if (vector.length !== dimensions) {
      throw new EmbeddingError(
        "DIMENSION_MISMATCH",
        `vector[${index}] length ${vector.length} does not match dimensions ${dimensions}`
      );
    }

    for (let offset = 0; offset < vector.length; offset++) {

      const value = vector[offset];

      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new EmbeddingError(
          "INVALID_VECTOR",
          `vector[${index}][${offset}] must be a finite number`
        );
      }

    }

  }

}
