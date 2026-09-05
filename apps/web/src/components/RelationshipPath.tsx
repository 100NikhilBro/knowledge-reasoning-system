import type { RelationshipPathHop } from "../lib/graph-from-result";

interface RelationshipPathProps {
  hops: RelationshipPathHop[];
}

/**
 * SVG relationship path built only from backend relationship hops.
 */
export function RelationshipPath({ hops }: RelationshipPathProps) {
  if (hops.length === 0) {
    return (
      <section className="panel" aria-labelledby="path-title">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Relationships</p>
            <h2 className="panel-title" id="path-title">
              Relationship path
            </h2>
          </div>
        </div>
        <p className="muted">
          No relationship edges were present in the reasoning trace for this
          answer.
        </p>
      </section>
    );
  }

  const nodeWidth = 148;
  const gap = 56;
  const height = 112;
  const width = hops.length * (nodeWidth + gap) + nodeWidth + 24;

  const nodes: Array<{ id: string; label: string; x: number }> = [];
  const seen = new Set<string>();

  function pushNode(id: string, label: string) {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    nodes.push({
      id,
      label,
      x: 12 + nodes.length * (nodeWidth + gap)
    });
  }

  for (const hop of hops) {
    pushNode(hop.fromId, hop.fromLabel);
    pushNode(hop.toId, hop.toLabel);
  }

  const nodeX = new Map(nodes.map((node) => [node.id, node.x]));

  return (
    <section className="panel" aria-labelledby="path-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Relationships</p>
          <h2 className="panel-title" id="path-title">
            Relationship path
          </h2>
        </div>
        <span className="mono muted">{hops.length} edges</span>
      </div>

      <div className="path-scroll">
        <svg
          className="path-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={hops
            .map(
              (hop) =>
                `${hop.fromLabel} ${hop.relationshipType} ${hop.toLabel}`
            )
            .join(", ")}
        >
          <defs>
            <marker
              id="path-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L7,3 L0,6 Z" fill="currentColor" />
            </marker>
          </defs>

          {hops.map((hop, index) => {
            const x1 = (nodeX.get(hop.fromId) ?? 0) + nodeWidth;
            const x2 = nodeX.get(hop.toId) ?? 0;
            const y = height / 2;

            return (
              <g
                key={`${hop.fromId}-${hop.relationshipType}-${hop.toId}-${index}`}
                className="path-edge"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  markerEnd="url(#path-arrow)"
                />
                <rect
                  x={(x1 + x2) / 2 - 46}
                  y={y - 28}
                  width="92"
                  height="20"
                  rx="2"
                  className="path-rel-bg"
                />
                <text
                  x={(x1 + x2) / 2}
                  y={y - 14}
                  textAnchor="middle"
                  className="path-rel-label"
                >
                  {hop.relationshipType}
                </text>
              </g>
            );
          })}

          {nodes.map((node, index) => (
            <g
              key={node.id}
              className="path-node"
              style={{ animationDelay: `${index * 70}ms` }}
              transform={`translate(${node.x} ${height / 2 - 18})`}
            >
              <rect width={nodeWidth} height="36" rx="4" />
              <text x={nodeWidth / 2} y="22" textAnchor="middle">
                {truncate(node.label, 18)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <ol className="path-list" aria-label="Relationship hops">
        {hops.map((hop, index) => (
          <li key={`${hop.fromId}-${hop.relationshipType}-${hop.toId}-${index}`}>
            <span className="path-list-from">{hop.fromLabel}</span>
            <span className="path-list-rel mono">{hop.relationshipType}</span>
            <span className="path-list-to">{hop.toLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
