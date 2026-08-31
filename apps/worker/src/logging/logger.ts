export type LogLevel =
  | "debug"
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
  /(password|secret|api[_-]?key|token|authorization)/i;

function sanitizeContext(
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

    sanitized[key] = value;

  }

  return sanitized;

}

/**
 * Structured stdout logger. Never prints secret-like fields.
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
      ...(sanitizeContext(context) ?? {})
    };

    const line = JSON.stringify(entry);

    if (level === "error") {
      console.error(line);
      return;
    }

    console.log(line);

  }

}
