interface ExampleQueriesProps {
  examples: string[];
  onSelect: (query: string) => void;
  disabled?: boolean;
}

export function ExampleQueries({
  examples,
  onSelect,
  disabled = false
}: ExampleQueriesProps) {
  return (
    <div className="example-queries" aria-label="Example queries">
      {examples.map((example) => (
        <button
          key={example}
          type="button"
          className="example-chip"
          disabled={disabled}
          onClick={() => onSelect(example)}
        >
          {example}
        </button>
      ))}
    </div>
  );
}
