import type { ReasoningTrace } from "../types/reasoning";
import { resolveProvenanceChannel } from "../lib/provenance";
import { ProvenanceBadge } from "./ProvenanceBadge";

interface ReasoningTraceProps {
  trace: ReasoningTrace;
}

/**
 * Visual reasoning trace from public backend steps.
 * Parses "via REL (from → to)" when present; never invents edges.
 */
export function ReasoningTraceView({ trace }: ReasoningTraceProps) {
  if (trace.steps.length === 0) {
    return (
      <section className="panel" aria-labelledby="trace-title">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Trace</p>
            <h2 className="panel-title" id="trace-title">
              Reasoning trace
            </h2>
          </div>
        </div>
        <p className="muted">No reasoning steps were returned.</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="trace-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Trace</p>
          <h2 className="panel-title" id="trace-title">
            Reasoning trace
          </h2>
        </div>
        <span className="mono muted">{trace.steps.length} steps</span>
      </div>

      <ol className="trace-tree" aria-label="Reasoning timeline">
        {trace.steps.map((step, index) => {
          const parsed = parseViaDescription(step.description);
          const item = step.evidence[0];
          const channel = item
            ? resolveProvenanceChannel(item)
            : "unknown";

          return (
            <li
              key={`${index}-${step.description}`}
              className="trace-tree-item"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="trace-rail" aria-hidden="true">
                <span className="trace-dot" />
                {index < trace.steps.length - 1 ? (
                  <span className="trace-connector" />
                ) : null}
              </div>

              <div className="trace-content">
                <div className="trace-content-top">
                  <span className="trace-index mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item ? <ProvenanceBadge channel={channel} /> : null}
                </div>

                {parsed ? (
                  <div className="trace-rel-block">
                    <span className="trace-entity">{parsed.entity}</span>
                    <svg
                      className="trace-arrow"
                      viewBox="0 0 48 16"
                      width="48"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 8 H38"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M34 3 L42 8 L34 13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className="trace-rel mono">{parsed.relationship}</span>
                    <svg
                      className="trace-arrow"
                      viewBox="0 0 48 16"
                      width="48"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 8 H38"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M34 3 L42 8 L34 13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className="trace-target mono">{parsed.target}</span>
                  </div>
                ) : (
                  <p className="trace-desc">{step.description}</p>
                )}

                {item?.relationship ? (
                  <p className="trace-edge mono muted">
                    {item.relationship.from} —{item.relationship.type}→{" "}
                    {item.relationship.to}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function parseViaDescription(
  description: string
): {
  entity: string;
  relationship: string;
  target: string;
} | null {
  const match =
    description.match(
      /^Selected\s+(.+?)\s+via\s+(\S+)\s+\((.+?)\s*→\s*(.+?)\)$/u
    );

  if (!match) {
    return null;
  }

  return {
    entity: match[1] ?? "",
    relationship: match[2] ?? "",
    target: match[4] ?? match[3] ?? ""
  };
}
