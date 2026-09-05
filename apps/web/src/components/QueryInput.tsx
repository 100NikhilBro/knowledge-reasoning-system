import type { FormEvent, KeyboardEvent } from "react";
import { ExampleQueries } from "./ExampleQueries";

const EXAMPLES = [
  "What is PEP-484?",
  "Why was PEP-484 proposed?",
  "How did PEP-484 address readability?",
  "How is PEP-484 connected to type hints?",
  "Who proposed PEP-484?"
] as const;

interface QueryInputProps {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function QueryInput({
  value,
  loading,
  onChange,
  onSubmit
}: QueryInputProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section className="panel query-panel" aria-labelledby="query-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Query</p>
          <h2 className="panel-title" id="query-title">
            Ask a complex knowledge question
          </h2>
        </div>
      </div>

      <form className="query-form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="reasoning-query">
          Reasoning query
        </label>
        <textarea
          id="reasoning-query"
          className="query-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask across entities, relationships, and multi-hop evidence…"
          disabled={loading}
          rows={3}
        />

        <div className="query-actions">
          <button
            type="submit"
            className="button"
            disabled={loading || value.trim().length === 0}
          >
            {loading ? "Reasoning…" : "Run"}
          </button>
          <span className="query-hint mono muted">
            Ctrl/⌘ + Enter
          </span>
        </div>

        <ExampleQueries
          examples={[...EXAMPLES]}
          disabled={loading}
          onSelect={onChange}
        />
      </form>
    </section>
  );
}
