const PIPELINE_STEPS = [
  {
    name: "Query",
    detail: "Understands the user's reasoning question."
  },
  {
    name: "Retrieve",
    detail:
      "Finds relevant knowledge using the knowledge graph and semantic/vector retrieval."
  },
  {
    name: "Reason",
    detail:
      "Uses graph relationships and reasoning strategies to connect relevant entities."
  },
  {
    name: "Ground",
    detail:
      "Builds the answer context only from retrieved knowledge evidence."
  },
  {
    name: "Verify",
    detail:
      "Checks the generated answer against grounded evidence and fails closed when unsupported."
  },
  {
    name: "Answer",
    detail:
      "Produces a natural-language answer with evidence and citations."
  }
] as const;

const SUPPORTED = [
  "Knowledge graph reasoning",
  "Semantic/vector retrieval",
  "Hybrid graph + vector retrieval",
  "Relationship-focused questions",
  "Multi-hop reasoning",
  "Grounded LLM answers",
  "Citations, reasoning trace, and confidence",
  "Fail-closed hallucination protection",
  "Comparison reasoning"
] as const;

const HOW_TO_USE = [
  "What is PEP-484?",
  "Who proposed PEP-484?",
  "What feature does PEP-484 introduce?",
  "What decision resulted from PEP-484?",
  "Who proposed PEP-484, what did it introduce, and what concern did it address?"
] as const;

interface HowKrsWorksProps {
  onSelectExample?: (query: string) => void;
}

export function HowKrsWorks({ onSelectExample }: HowKrsWorksProps) {
  return (
    <section
      className="panel how-krs"
      aria-labelledby="how-krs-title"
    >
      <div>
        <p className="panel-kicker">Overview</p>
        <h2 className="panel-title" id="how-krs-title">
          How KRS Works
        </h2>
      </div>

      <ol className="how-krs-flow">
        {PIPELINE_STEPS.map((step, index) => (
          <li key={step.name} className="how-krs-step">
            <div className="how-krs-step-label">
              <span className="how-krs-step-name">{step.name}</span>
              {index < PIPELINE_STEPS.length - 1 ? (
                <span className="how-krs-arrow" aria-hidden="true">
                  ↓
                </span>
              ) : null}
            </div>
            <p className="muted how-krs-step-detail">{step.detail}</p>
          </li>
        ))}
      </ol>

      <div className="how-krs-columns">
        <div>
          <h3 className="how-krs-subtitle">Currently Supported</h3>
          <ul className="how-krs-list">
            {SUPPORTED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="how-krs-subtitle">How to Use KRS</h3>
          <p className="muted how-krs-note">
            Answers come from indexed knowledge only — not unrestricted web or
            model memory.
          </p>
          <ul className="how-krs-examples">
            {HOW_TO_USE.map((example) => (
              <li key={example}>
                {onSelectExample ? (
                  <button
                    type="button"
                    className="example-chip"
                    onClick={() => onSelectExample(example)}
                  >
                    {example}
                  </button>
                ) : (
                  <span className="mono">{example}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
