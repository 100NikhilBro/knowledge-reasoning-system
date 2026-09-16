/**
 * Canonical entity-key normalization for stable graph IDs.
 *
 * Formatting variants of the same concept map to one key.
 * Distinct concepts must still produce distinct keys.
 */

export function canonicalizeEntityKey(
  type: string,
  value: string
): string {

  const raw =
    value.trim();

  if (!raw) {
    return "";
  }

  const prefix =
    `${type.toLowerCase()}:`;

  const withoutPrefix =
    raw.toLowerCase().startsWith(prefix)
      ? raw.slice(prefix.length)
      : raw;

  switch (type) {

    case "Proposal": {

      const match =
        withoutPrefix.match(/pep[\s_-]*(\d+)/i) ??
        withoutPrefix.match(/^(\d+)$/);

      if (match?.[1]) {
        return `PEP-${match[1]}`;
      }

      return withoutPrefix
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    }

    case "PythonVersion": {

      return withoutPrefix
        .toLowerCase()
        .replace(/\s+/g, "");

    }

    case "Author":
    case "Feature":
    case "Concern":
    case "Decision":
    default: {

      return withoutPrefix
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    }

  }

}

/**
 * Deterministic graph node id: `{typeLower}:{canonicalKey}`.
 */
export function buildGraphId(
  type: string,
  value: string
): string {

  const key =
    canonicalizeEntityKey(type, value);

  const prefix =
    `${type.toLowerCase()}:`;

  if (!key) {
    return prefix.slice(0, -1);
  }

  return `${prefix}${key}`;

}
