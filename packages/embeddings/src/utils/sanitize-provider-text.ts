/**
 * Redact secrets from provider/error text before surfacing to callers/logs.
 */
export function sanitizeProviderText(
  text: string,
  secrets: readonly (string | undefined)[] = []
): string {

  let sanitized = text;

  for (const secret of secrets) {

    const value = secret?.trim();

    if (!value || value.length < 4) {
      continue;
    }

    sanitized = sanitized.split(value).join("[REDACTED]");

  }

  // Common credential leakage patterns
  sanitized = sanitized.replace(
    /Bearer\s+[A-Za-z0-9._-]+/gi,
    "Bearer [REDACTED]"
  );

  sanitized = sanitized.replace(
    /api[_-]?key["']?\s*[:=]\s*["']?[^\s"',}]+/gi,
    "api_key=[REDACTED]"
  );

  return sanitized;

}
