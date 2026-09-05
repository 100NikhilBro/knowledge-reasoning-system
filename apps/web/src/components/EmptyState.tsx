import { ExampleQueries } from "./ExampleQueries";

interface EmptyStateProps {
  onSelectExample: (query: string) => void;
}

const EXAMPLES = [
  "What is PEP-484?",
  "Why was PEP-484 proposed?",
  "How did PEP-484 address readability?",
  "How is PEP-484 connected to type hints?",
  "Who proposed PEP-484?"
] as const;

export function EmptyState({ onSelectExample }: EmptyStateProps) {
  return (
    <section className="panel empty-state" aria-labelledby="empty-title">
      <div>
        <p className="panel-kicker">Knowledge reasoning</p>
        <h2 className="panel-title" id="empty-title">
          Start with grounded evidence.
        </h2>
      </div>
      <p className="muted">
        Ask a question and follow the relationships, evidence, and reasoning
        behind the answer. Unsupported claims fail closed.
      </p>

      <ol className="empty-pipeline" aria-label="Reasoning pipeline">
        {[
          "Question",
          "Retrieval",
          "Evidence",
          "Relationships",
          "Reasoning",
          "Verification",
          "Answer"
        ].map((step, index, all) => (
          <li key={step}>
            <span>{step}</span>
            {index < all.length - 1 ? (
              <span className="empty-pipeline-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <ExampleQueries
        examples={[...EXAMPLES]}
        onSelect={onSelectExample}
      />
    </section>
  );
}
