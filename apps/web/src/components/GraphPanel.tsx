import { useMemo, useState } from "react";
import type { GraphNode, GraphViewModel } from "../lib/graph-from-result";

interface GraphPanelProps {
  model: GraphViewModel;
}

function layoutNodes(nodes: GraphNode[]) {
  const width = 640;
  const height = 240;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;

  if (nodes.length === 0) {
    return [];
  }

  if (nodes.length === 1) {
    return [{ ...nodes[0], x: cx, y: cy }];
  }

  return nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
    return {
      ...node,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    };
  });
}

export function GraphPanel({ model }: GraphPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positioned = useMemo(
    () => layoutNodes(model.nodes),
    [model.nodes]
  );

  const selected =
    positioned.find((node) => node.id === selectedId) ?? null;

  const nodeById = useMemo(() => {
    const map = new Map(positioned.map((node) => [node.id, node]));
    return map;
  }, [positioned]);

  return (
    <section className="panel" aria-labelledby="graph-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">05 // Graph</p>
          <h2 className="panel-title" id="graph-title">
            Knowledge graph view
          </h2>
        </div>
      </div>

      {model.nodes.length === 0 ? (
        <p className="muted">
          Graph visualization needs entity evidence from the reasoning
          response. No dedicated graph API is exposed — nodes appear here when
          the `/reason` trace includes grounded entities.
        </p>
      ) : (
        <>
          {!model.hasRelationshipData ? (
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              Showing entities from grounded evidence. Relationship edges are
              drawn only when the response includes relationship data.
            </p>
          ) : null}

          <div className="graph-canvas">
            <svg
              className="graph-svg"
              viewBox="0 0 640 240"
              role="img"
              aria-label="Entity graph derived from reasoning evidence"
            >
              {model.edges.map((edge) => {
                const from = nodeById.get(edge.from);
                const to = nodeById.get(edge.to);
                if (!from || !to) {
                  return null;
                }
                return (
                  <line
                    key={edge.id}
                    className="graph-edge"
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                  />
                );
              })}

              {positioned.map((node) => (
                <g
                  key={node.id}
                  className="graph-node"
                  data-selected={selectedId === node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={() => setSelectedId(node.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${node.type} ${node.label}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(node.id);
                    }
                  }}
                >
                  <circle r="18" />
                  <text textAnchor="middle" y="32">
                    {node.label.length > 14
                      ? `${node.label.slice(0, 12)}…`
                      : node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {selected ? (
            <div className="graph-detail" aria-live="polite">
              <div>{selected.type}</div>
              <div>{selected.label}</div>
              <div>id: {selected.id}</div>
              <div>source: {selected.source}</div>
              <div>confidence: {selected.confidence}</div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              Select a node to inspect entity details from the response.
            </p>
          )}
        </>
      )}
    </section>
  );
}
