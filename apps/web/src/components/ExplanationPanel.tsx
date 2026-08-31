import type { AnswerExplanation } from "../types/reasoning";

interface ExplanationPanelProps {
  explanation?: AnswerExplanation;
}

export function ExplanationPanel({ explanation }: ExplanationPanelProps) {
  if (!explanation) {
    return (
      <p className="muted">No explanation returned for this result.</p>
    );
  }

  return (
    <div>
      <p className="panel-kicker">Explanation</p>
      <ul className="list" aria-label="Explanation reasoning">
        {explanation.reasoning.map((line) => (
          <li key={line} className="list-item mono">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
