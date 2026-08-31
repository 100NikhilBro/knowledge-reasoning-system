/**
 * Extract the primary vector size from a Qdrant getCollection response.
 *
 * Supports unnamed vectors `{ size, distance }` and named-vector maps.
 */
export function extractCollectionVectorSize(
  collectionInfo: unknown
): number | undefined {

  const root =
    collectionInfo && typeof collectionInfo === "object"
      ? collectionInfo as Record<string, unknown>
      : undefined;

  const result =
    root?.result && typeof root.result === "object"
      ? root.result as Record<string, unknown>
      : root;

  const config =
    result?.config && typeof result.config === "object"
      ? result.config as Record<string, unknown>
      : undefined;

  const params =
    config?.params && typeof config.params === "object"
      ? config.params as Record<string, unknown>
      : undefined;

  const vectors = params?.vectors;

  if (!vectors || typeof vectors !== "object") {
    return undefined;
  }

  if (
    "size" in vectors &&
    typeof (vectors as { size?: unknown }).size === "number"
  ) {
    const size = (vectors as { size: number }).size;

    return Number.isInteger(size) && size > 0
      ? size
      : undefined;
  }

  for (const value of Object.values(vectors)) {

    if (
      value &&
      typeof value === "object" &&
      "size" in value &&
      typeof (value as { size?: unknown }).size === "number"
    ) {
      const size = (value as { size: number }).size;

      if (Number.isInteger(size) && size > 0) {
        return size;
      }
    }

  }

  return undefined;

}
