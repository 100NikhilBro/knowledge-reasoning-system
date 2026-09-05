import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { CitationList } from "./CitationList";
import {
  classifyGroundingState,
  isVerifiedAppearance
} from "../lib/provenance";
import type { ReasoningResult } from "../types/reasoning";

interface AnswerPanelProps {
  result: ReasoningResult;
  query?: string;
}

export function AnswerPanel({ result, query }: AnswerPanelProps) {
  const grounding = classifyGroundingState(result);
  const verified = isVerifiedAppearance(result);
  const failClosed = grounding === "fail_closed";

  return (
    <section
      className="panel answer-panel"
      data-state={grounding}
      aria-labelledby="answer-title"
    >
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Answer</p>
          <h2 className="panel-title" id="answer-title">
            {failClosed ? "No grounded answer found" : "Grounded response"}
          </h2>
        </div>

        <div className="answer-status-row" aria-label="Answer status">
          <span
            className="status-chip"
            data-tone={failClosed ? "warn" : "ok"}
          >
            {failClosed ? "Fail-closed" : "Grounded"}
          </span>
          <span
            className="status-chip"
            data-tone={verified ? "ok" : "muted"}
          >
            {verified ? "Verified" : "Unverified"}
          </span>
        </div>
      </div>

      {query ? (
        <p className="answer-query mono muted">Q · {query}</p>
      ) : null}

      {result.comparison ? (
        <p className="muted mono">Comparison mode</p>
      ) : null}

      {failClosed ? (
        <div className="fail-closed-body" role="status">
          <p className="answer-body">
            The available knowledge does not provide sufficient evidence to
            support this question.
          </p>
          <p className="muted">
            KRS failed closed rather than inventing an unsupported explanation.
          </p>
        </div>
      ) : (
        <div className="answer-body">
          {result.answer.trim().length > 0
            ? result.answer
            : "No answer was produced for this query."}
        </div>
      )}

      <ConfidenceIndicator confidence={result.confidence} />

      {result.explanation?.reasoning?.length ? (
        <div className="answer-notes">
          <p className="panel-kicker">Grounding notes</p>
          <ul className="answer-notes-list">
            {result.explanation.reasoning.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="answer-citations">
        <p className="panel-kicker">Citations</p>
        <CitationList citations={result.citations} />
      </div>
    </section>
  );
}
