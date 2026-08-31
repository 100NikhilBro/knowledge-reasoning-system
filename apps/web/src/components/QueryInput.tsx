import type { FormEvent } from "react";
import { ExampleQueries } from "./ExampleQueries";

const EXAMPLES = ["What is PEP-484?", "What is typing?"];

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

  return (
    <section className="panel" aria-labelledby="query-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">01 // Query</p>
          <h2 className="panel-title" id="query-title">
            Ask the knowledge graph
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
          placeholder="Enter a grounded knowledge query…"
          disabled={loading}
          rows={4}
        />

        <div className="query-actions">
          <button
            type="submit"
            className="button"
            disabled={loading || value.trim().length === 0}
          >
            {loading ? "Reasoning…" : "Run reasoning"}
          </button>
          <ExampleQueries
            examples={EXAMPLES}
            disabled={loading}
            onSelect={onChange}
          />
        </div>
      </form>
    </section>
  );
}
