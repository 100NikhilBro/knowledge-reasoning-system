import type { Evidence } from "../types/reasoning";
import { resolveProvenanceChannel } from "../lib/provenance";
import { ProvenanceBadge } from "./ProvenanceBadge";

interface EvidencePanelProps {
  evidence: Evidence[];
}

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  return (
    <section className="panel" aria-labelledby="evidence-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Evidence</p>
          <h2 className="panel-title" id="evidence-title">
            Grounded evidence
          </h2>
        </div>
        <span className="mono muted">{evidence.length}</span>
      </div>

      {evidence.length === 0 ? (
        <p className="muted">
          No evidence entities were present in the reasoning trace.
        </p>
      ) : (
        <ul className="evidence-grid" aria-label="Grounded evidence">
          {evidence.map((item) => {
            const channel = resolveProvenanceChannel(item);

            return (
              <li key={item.entity.id} className="evidence-card">
                <div className="evidence-card-top">
                  <div>
                    <p className="evidence-type mono">{item.entity.type}</p>
                    <h3 className="evidence-label">{item.entity.label}</h3>
                  </div>
                  <ProvenanceBadge channel={channel} />
                </div>

                <dl className="evidence-meta">
                  <div>
                    <dt>Entity</dt>
                    <dd className="mono">{item.entity.id}</dd>
                  </div>
                  <div>
                    <dt>Document</dt>
                    <dd className="mono">{item.entity.source}</dd>
                  </div>
                  {item.relationship ? (
                    <div>
                      <dt>Relationship</dt>
                      <dd className="mono">
                        {item.relationship.type}{" "}
                        <span className="muted">
                          ({item.relationship.from} → {item.relationship.to})
                        </span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
