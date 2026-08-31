import type { Evidence } from "../types/reasoning";

interface EvidencePanelProps {
  evidence: Evidence[];
}

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  return (
    <section className="panel" aria-labelledby="evidence-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">02 // Evidence</p>
          <h2 className="panel-title" id="evidence-title">
            Grounded evidence
          </h2>
        </div>
      </div>

      {evidence.length === 0 ? (
        <p className="muted">
          No evidence entities were present in the reasoning trace.
        </p>
      ) : (
        <ul className="list" aria-label="Grounded evidence">
          {evidence.map((item) => (
            <li key={item.entity.id} className="list-item">
              <div className="mono">
                {item.entity.type} · {item.entity.label}
              </div>
              <div className="muted mono">{item.entity.id}</div>
              <div className="muted mono">
                source={item.entity.source} · channel={item.source} ·
                score={item.score} · confidence={item.entity.confidence}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
