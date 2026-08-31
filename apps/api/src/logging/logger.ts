export type LogLevel =
  | "info"
  | "warn"
  | "error";

export interface Logger {

  info(
    message: string,
    context?: Record<string, unknown>
  ): void;

  warn(
    message: string,
    context?: Record<string, unknown>
  ): void;

  error(
    message: string,
    context?: Record<string, unknown>
  ): void;

}

const SECRET_KEY_PATTERN =
  /(password|secret|api[_-]?key|token|authorization|credential|cookie)/i;

const SECRET_VALUE_PATTERN =
  /(bearer\s+[a-z0-9._~+/=-]+|neo4j|redis:\/\/|qdrant|bolt:\/\/)/i;

function sanitizeValue(
  value: unknown
): unknown {

  if (typeof value === "string") {

    if (SECRET_VALUE_PATTERN.test(value)) {
      return "[redacted]";
    }

    return value;

  }

  return value;

}

export function sanitizeLogContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {

  if (!context) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {

    if (SECRET_KEY_PATTERN.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }

    sanitized[key] = sanitizeValue(value);

  }

  return sanitized;

}

/**
 * Structured stdout logger for the API boundary.
 * Never prints secret-like fields or credential-bearing values.
 */
export class ConsoleLogger
  implements Logger {

  info(
    message: string,
    context?: Record<string, unknown>
  ): void {

    this.write("info", message, context);

  }

  warn(
    message: string,
    context?: Record<string, unknown>
  ): void {

    this.write("warn", message, context);

  }

  error(
    message: string,
    context?: Record<string, unknown>
  ): void {

    this.write("error", message, context);

  }

  private write(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {

    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(sanitizeLogContext(context) ?? {})
    };

    const line = JSON.stringify(entry);

    if (level === "error") {
      console.error(line);
      return;
    }

    console.log(line);

  }

}
