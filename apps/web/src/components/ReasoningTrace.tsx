import type { ReasoningTrace } from "../types/reasoning";

interface ReasoningTraceProps {
  trace: ReasoningTrace;
}

export function ReasoningTraceView({ trace }: ReasoningTraceProps) {
  if (trace.steps.length === 0) {
    return (
      <section className="panel" aria-labelledby="trace-title">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">03 // Trace</p>
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
          <p className="panel-kicker">03 // Trace</p>
          <h2 className="panel-title" id="trace-title">
            Reasoning trace
          </h2>
        </div>
        <span className="mono muted">{trace.steps.length} steps</span>
      </div>

      <div className="trace" role="log" aria-label="Reasoning timeline">
        {trace.steps.map((step, index) => (
          <div className="trace-line" key={`${index}-${step.description}`}>
            <span className="trace-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="trace-desc">{step.description}</div>
              {step.evidence.map((item) => (
                <div
                  className="trace-evidence"
                  key={`${item.entity.id}-${item.source}`}
                >
                  → {item.entity.type}:{item.entity.label} [{item.entity.id}]
                  via {item.source}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
