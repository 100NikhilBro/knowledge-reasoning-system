interface ErrorStateProps {
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message,
  code,
  onRetry
}: ErrorStateProps) {
  const kind =
    code === "NETWORK_ERROR"
      ? "network"
      : code === "INVALID_REQUEST"
        ? "validation"
        : "api";

  return (
    <div
      className="error-banner"
      role="alert"
      data-kind={kind}
    >
      <div>
        <p className="error-kind mono">
          {kind === "network"
            ? "Network error"
            : kind === "validation"
              ? "Validation error"
              : "API error"}
        </p>
        <p className="error-message">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="button button-ghost" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
