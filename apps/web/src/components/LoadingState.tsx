const STAGES = [
  "RETRIEVING EVIDENCE",
  "BUILDING CONTEXT",
  "VERIFYING ANSWER"
] as const;

interface LoadingStateProps {
  activeIndex?: number;
}

export function LoadingState({ activeIndex = 1 }: LoadingStateProps) {
  return (
    <section className="panel" aria-live="polite" aria-busy="true">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Pipeline</p>
          <h2 className="panel-title">Reasoning in progress</h2>
        </div>
      </div>

      <div className="loading-flow">
        {STAGES.map((stage, index) => (
          <div key={stage}>
            <div
              className="loading-step"
              data-active={index <= activeIndex}
            >
              <span aria-hidden="true">▸</span>
              <span>{stage}</span>
            </div>
            {index < STAGES.length - 1 ? (
              <div className="loading-arrow" aria-hidden="true">
                ↓
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: "0.85rem" }}>
        Stage labels are UI presentation only — the API returns a single
        completed reasoning result.
      </p>
    </section>
  );
}
