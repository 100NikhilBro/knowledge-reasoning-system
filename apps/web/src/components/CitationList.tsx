import type { Citation } from "../types/reasoning";

interface CitationListProps {
  citations: Citation[];
}

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) {
    return <p className="muted">No citations in this result.</p>;
  }

  return (
    <ul className="list" aria-label="Citations">
      {citations.map((citation) => (
        <li
          key={`${citation.entityId}:${citation.source}`}
          className="list-item"
        >
          <div className="mono">{citation.entityId}</div>
          <div className="muted mono">source: {citation.source}</div>
        </li>
      ))}
    </ul>
  );
}
