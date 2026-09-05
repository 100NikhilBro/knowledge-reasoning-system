import { useMemo, useState } from "react";
import type { GraphNode, GraphViewModel } from "../lib/graph-from-result";
import { ProvenanceBadge } from "./ProvenanceBadge";

interface GraphPanelProps {
  model: GraphViewModel;
}

function layoutNodes(nodes: GraphNode[]) {
  const width = 640;
  const height = 260;
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
    return new Map(positioned.map((node) => [node.id, node]));
  }, [positioned]);

  return (
    <section className="panel" aria-labelledby="graph-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Graph</p>
          <h2 className="panel-title" id="graph-title">
            Evidence graph
          </h2>
        </div>
      </div>

      {model.nodes.length === 0 ? (
        <p className="muted">
          Entities appear here when the `/reason` trace includes grounded
          evidence. Edges are drawn only from real relationships in the
          response.
        </p>
      ) : (
        <>
          {!model.hasRelationshipData ? (
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              Showing entities from grounded evidence. No relationship edges
              were present in this result.
            </p>
          ) : null}

          <div className="graph-canvas">
            <svg
              className="graph-svg"
              viewBox="0 0 640 260"
              role="img"
              aria-label="Entity graph derived from reasoning evidence"
            >
              <defs>
                <marker
                  id="graph-arrow"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L7,3 L0,6 Z" fill="currentColor" />
                </marker>
              </defs>

              {model.edges.map((edge) => {
                const from = nodeById.get(edge.from);
                const to = nodeById.get(edge.to);
                if (!from || !to) {
                  return null;
                }
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                return (
                  <g key={edge.id} className="graph-edge-group">
                    <line
                      className="graph-edge"
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      markerEnd="url(#graph-arrow)"
                    />
                    <text
                      className="graph-edge-label"
                      x={mx}
                      y={my - 8}
                      textAnchor="middle"
                    >
                      {edge.type}
                    </text>
                  </g>
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
                  <circle r="20" />
                  <text textAnchor="middle" y="36">
                    {node.label.length > 16
                      ? `${node.label.slice(0, 14)}…`
                      : node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {selected ? (
            <div className="graph-detail" aria-live="polite">
              <div className="graph-detail-top">
                <div>
                  <div className="mono muted">{selected.type}</div>
                  <div>{selected.label}</div>
                </div>
                <ProvenanceBadge channel={selected.provenance} />
              </div>
              <div className="mono muted">id: {selected.id}</div>
              <div className="mono muted">source: {selected.source}</div>
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
