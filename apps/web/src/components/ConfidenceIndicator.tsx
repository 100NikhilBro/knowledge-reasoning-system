interface ConfidenceIndicatorProps {
  confidence: number;
}

/**
 * Visualizes the backend confidence value without reinterpretation.
 * Uses a soft display cap for the bar width only when values exceed 1.
 */
export function ConfidenceIndicator({
  confidence
}: ConfidenceIndicatorProps) {
  const barRatio =
    confidence <= 0
      ? 0
      : confidence <= 1
        ? confidence
        : Math.min(confidence / 10, 1);

  return (
    <div className="confidence" aria-label={`Confidence ${confidence}`}>
      <div className="confidence-meta">
        <span>confidence</span>
        <span>{confidence}</span>
      </div>
      <div className="confidence-track" aria-hidden="true">
        <div
          className="confidence-fill"
          style={{ width: `${Math.round(barRatio * 100)}%` }}
        />
      </div>
    </div>
  );
}
