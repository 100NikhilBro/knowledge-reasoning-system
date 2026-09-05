import { useMemo, useState } from "react";
import type {
  GraphEdge,
  GraphNode,
  GraphViewModel
} from "../lib/graph-from-result";
import { ProvenanceBadge } from "./ProvenanceBadge";

interface GraphPanelProps {
  model: GraphViewModel;
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

/**
 * Hub-and-spoke when one node has degree ≥ 2; otherwise a balanced ring.
 * Positions follow real edge endpoints — never invents links.
 */
function layoutNodes(
  nodes: GraphNode[],
  edges: GraphEdge[]
): PositionedNode[] {
  const width = 640;
  const height = 300;
  const cx = width / 2;
  const cy = height / 2;

  if (nodes.length === 0) {
    return [];
  }

  if (nodes.length === 1) {
    return [{ ...nodes[0]!, x: cx, y: cy }];
  }

  const degree = new Map<string, number>();
  for (const node of nodes) {
    degree.set(node.id, 0);
  }
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  let hubId: string | undefined;
  let best = 0;
  for (const [id, value] of degree) {
    if (value > best) {
      best = value;
      hubId = id;
    }
  }

  if (hubId && best >= 2) {
    const hub = nodes.find((node) => node.id === hubId)!;
    const spokes = nodes.filter((node) => node.id !== hubId);
    const radius = Math.min(width, height) * 0.36;

    return [
      { ...hub, x: cx, y: cy },
      ...spokes.map((node, index) => {
        const angle =
          (Math.PI * 2 * index) / Math.max(spokes.length, 1) - Math.PI / 2;
        return {
          ...node,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius
        };
      })
    ];
  }

  const radius = Math.min(width, height) * 0.34;
  return nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
    return {
      ...node,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    };
  });
}

function edgeGeometry(
  from: PositionedNode,
  to: PositionedNode
): { x1: number; y1: number; x2: number; y2: number; mx: number; my: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const inset = 24;
  const ux = dx / length;
  const uy = dy / length;

  const x1 = from.x + ux * inset;
  const y1 = from.y + uy * inset;
  const x2 = to.x - ux * inset;
  const y2 = to.y - uy * inset;

  return {
    x1,
    y1,
    x2,
    y2,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2
  };
}

export function GraphPanel({ model }: GraphPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positioned = useMemo(
    () => layoutNodes(model.nodes, model.edges),
    [model.nodes, model.edges]
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
          ) : (
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              Topology follows real source → relationship → target edges only.
            </p>
          )}

          <div className="graph-canvas">
            <svg
              className="graph-svg"
              viewBox="0 0 640 300"
              role="img"
              aria-label="Entity graph derived from reasoning evidence"
            >
              <defs>
                <marker
                  id="graph-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
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
                const geometry = edgeGeometry(from, to);
                return (
                  <g key={edge.id} className="graph-edge-group">
                    <line
                      className="graph-edge"
                      x1={geometry.x1}
                      y1={geometry.y1}
                      x2={geometry.x2}
                      y2={geometry.y2}
                      markerEnd="url(#graph-arrow)"
                    />
                    <rect
                      className="graph-edge-label-bg"
                      x={geometry.mx - 44}
                      y={geometry.my - 18}
                      width="88"
                      height="18"
                      rx="2"
                    />
                    <text
                      className="graph-edge-label"
                      x={geometry.mx}
                      y={geometry.my - 5}
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
                  <circle r="22" />
                  <text textAnchor="middle" y="38">
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
