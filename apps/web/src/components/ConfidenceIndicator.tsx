import {
  clampConfidenceDisplay,
  formatConfidencePercent
} from "../lib/provenance";

interface ConfidenceIndicatorProps {
  confidence: number;
}

/**
 * Visualizes the public backend confidence value (already in [0, 1]).
 * Does not reinterpret or expose raw retrieval scores.
 */
export function ConfidenceIndicator({
  confidence
}: ConfidenceIndicatorProps) {
  const clamped = clampConfidenceDisplay(confidence);
  const percent = formatConfidencePercent(confidence);

  return (
    <div
      className="confidence"
      aria-label={`Grounded confidence ${percent}`}
    >
      <div className="confidence-meta">
        <span>Grounded confidence</span>
        <span className="confidence-value">{percent}</span>
      </div>
      <div
        className="confidence-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuetext={percent}
      >
        <div
          className="confidence-fill"
          style={{ width: `${Math.round(clamped * 100)}%` }}
        />
      </div>
    </div>
  );
}
