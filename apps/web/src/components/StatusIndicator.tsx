import type { HealthStatus } from "../types/reasoning";

interface StatusIndicatorProps {
  status: HealthStatus;
}

const LABELS: Record<HealthStatus, string> = {
  ok: "API online",
  down: "API offline",
  unknown: "API unknown"
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <span
      className="status-indicator"
      data-status={status}
      role="status"
      aria-live="polite"
    >
      <span className="status-dot" aria-hidden="true" />
      <span>{LABELS[status]}</span>
    </span>
  );
}
