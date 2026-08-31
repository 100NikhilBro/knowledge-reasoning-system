import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { ExplanationPanel } from "./ExplanationPanel";
import { CitationList } from "./CitationList";
import type { ReasoningResult } from "../types/reasoning";

interface AnswerPanelProps {
  result: ReasoningResult;
}

export function AnswerPanel({ result }: AnswerPanelProps) {
  return (
    <section className="panel" aria-labelledby="answer-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">04 // Answer</p>
          <h2 className="panel-title" id="answer-title">
            Grounded response
          </h2>
        </div>
      </div>

      {result.comparison ? (
        <p className="muted mono">comparison mode</p>
      ) : null}

      <div className="answer-body">
        {result.answer.trim().length > 0
          ? result.answer
          : "No answer was produced for this query."}
      </div>

      <ConfidenceIndicator confidence={result.confidence} />

      <div style={{ marginTop: "1rem" }}>
        <ExplanationPanel explanation={result.explanation} />
      </div>

      <div style={{ marginTop: "1rem" }}>
        <p className="panel-kicker">Citations</p>
        <CitationList citations={result.citations} />
      </div>
    </section>
  );
}
