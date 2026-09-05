import type { ProvenanceChannel } from "../types/reasoning";
import { provenanceLabel } from "../lib/provenance";

interface ProvenanceBadgeProps {
  channel: ProvenanceChannel;
}

export function ProvenanceBadge({ channel }: ProvenanceBadgeProps) {
  return (
    <span
      className="provenance-badge"
      data-channel={channel}
      title={provenanceLabel(channel)}
    >
      <span className="provenance-badge-mark" aria-hidden="true">
        {channel === "hybrid" ? (
          <svg viewBox="0 0 16 16" width="12" height="12">
            <circle cx="5" cy="8" r="3" fill="currentColor" opacity="0.85" />
            <circle cx="11" cy="8" r="3" fill="currentColor" opacity="0.45" />
          </svg>
        ) : channel === "vector" ? (
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path
              d="M3 12 L8 3 L13 12 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="12" height="12">
            <circle cx="4" cy="8" r="2" fill="currentColor" />
            <circle cx="12" cy="8" r="2" fill="currentColor" />
            <path
              d="M6 8 H10"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        )}
      </span>
      <span>{provenanceLabel(channel)}</span>
    </span>
  );
}
