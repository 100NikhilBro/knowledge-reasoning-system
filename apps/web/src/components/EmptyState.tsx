import { ExampleQueries } from "./ExampleQueries";

interface EmptyStateProps {
  onSelectExample: (query: string) => void;
}

const EXAMPLES = [
  "What is PEP-484?",
  "Who proposed PEP-484?",
  "What feature does PEP-484 introduce?",
  "What decision resulted from PEP-484?",
  "Who proposed PEP-484, what did it introduce, and what concern did it address?"
] as const;

export function EmptyState({ onSelectExample }: EmptyStateProps) {
  return (
    <section className="panel empty-state" aria-labelledby="empty-title">
      <div>
        <p className="panel-kicker">Workspace</p>
        <h2 className="panel-title" id="empty-title">
          Ask a question over the indexed knowledge
        </h2>
      </div>
      <p className="muted">
        KRS answers from the indexed knowledge graph and vector store — not from
        unrestricted model knowledge. Results include citations, evidence, and a
        reasoning trace.
      </p>
      <ExampleQueries
        examples={[...EXAMPLES]}
        onSelect={onSelectExample}
      />
    </section>
  );
}
