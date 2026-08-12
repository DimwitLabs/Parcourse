import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tier = "domain" | "field" | "topic" | "skill";
type Node = {
  id: string;
  tier: Tier;
  label: string;
  description: string;
  mastery_score: number;
  times_encountered: number;
};
type Edge = { source_id: string; target_id: string; edge_type: "belongs_to" | "related_to" | "prerequisite_of" };
type Graph = { nodes: Node[]; edges: Edge[] };

type PositionedNode = Node & { x: number; y: number; r: number; depth: number };
type PositionedEdge = { x1: number; y1: number; x2: number; y2: number };

const NODE_RADIUS: Record<Tier, number> = { domain: 64, field: 52, topic: 46, skill: 40 };
const RING_GAP = 150;

function masteryClass(timesEncountered: number): "mastered" | "learning" | "new" {
  if (timesEncountered >= 4) return "mastered";
  if (timesEncountered >= 2) return "learning";
  return "new";
}

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.edge_type !== "belongs_to") continue;
    if (!byId.has(e.source_id) || !byId.has(e.target_id)) continue;
    if (!childrenOf.has(e.target_id)) childrenOf.set(e.target_id, []);
    childrenOf.get(e.target_id)!.push(e.source_id);
  }

  const roots = nodes.filter((n) => n.tier === "domain");
  const reachable = new Set<string>();
  function markReachable(id: string) {
    reachable.add(id);
    (childrenOf.get(id) || []).forEach(markReachable);
  }
  roots.forEach((r) => markReachable(r.id));
  const orphans = nodes.filter((n) => !reachable.has(n.id));

  function leafCount(id: string): number {
    const kids = childrenOf.get(id) || [];
    if (kids.length === 0) return 1;
    return kids.reduce((sum, k) => sum + leafCount(k), 0);
  }

  const positioned: PositionedNode[] = [];
  const singleRoot = roots.length === 1;

  function place(id: string, depth: number, angleStart: number, angleEnd: number) {
    const node = byId.get(id)!;
    const angle = (angleStart + angleEnd) / 2;
    const radius = singleRoot ? depth * RING_GAP : (depth + 1) * RING_GAP;
    positioned.push({
      ...node,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      r: NODE_RADIUS[node.tier],
      depth,
    });

    const kids = childrenOf.get(id) || [];
    if (kids.length === 0) return;
    const total = leafCount(id);
    let cursor = angleStart;
    for (const kid of kids) {
      const span = (angleEnd - angleStart) * (leafCount(kid) / total);
      place(kid, depth + 1, cursor, cursor + span);
      cursor += span;
    }
  }

  if (singleRoot) {
    place(roots[0].id, 0, 0, Math.PI * 2);
  } else if (roots.length > 1) {
    const totalLeaves = roots.reduce((s, r) => s + leafCount(r.id), 0);
    let cursor = 0;
    for (const r of roots) {
      const span = Math.PI * 2 * (leafCount(r.id) / totalLeaves);
      place(r.id, 0, cursor, cursor + span);
      cursor += span;
    }
  }

  const byPos = new Map(positioned.map((n) => [n.id, n]));
  const positionedEdges: PositionedEdge[] = [];
  for (const e of edges) {
    if (e.edge_type !== "belongs_to") continue;
    const a = byPos.get(e.source_id);
    const b = byPos.get(e.target_id);
    if (a && b) positionedEdges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  return { positioned, positionedEdges, orphans };
}

export default function KnowledgeGraphScreen() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const viewingUserId = params.get("user");

  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [hover, setHover] = useState<{ node: Node; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const path =
      viewingUserId && user?.role === "admin"
        ? `/knowledge-graph/users/${viewingUserId}`
        : "/knowledge-graph";
    apiFetch(path, token)
      .then(setGraph)
      .catch((err) => setError(String(err.message ?? err)));
  }, [token, viewingUserId, user]);

  const layout = useMemo(() => {
    if (!graph) return null;
    return layoutGraph(graph.nodes, graph.edges);
  }, [graph]);

  function recenter() {
    if (!layout || !wrapRef.current) return;
    const pad = 100;
    const minX = Math.min(...layout.positioned.map((n) => n.x - n.r)) - pad;
    const minY = Math.min(...layout.positioned.map((n) => n.y - n.r)) - pad;
    const el = wrapRef.current;
    el.scrollLeft = -minX - el.clientWidth / 2;
    el.scrollTop = -minY - el.clientHeight / 2;
  }

  useEffect(recenter, [layout]);

  useEffect(() => {
    const el = wrapRef.current!;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.min(2, Math.max(0.2, z + delta)));
      } else {
        el.scrollLeft += e.deltaX || e.deltaY;
        el.scrollTop += e.deltaY;
      }
    }
    let lastDist = 0;
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.hypot(dx, dy);
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastDist > 0) {
          const scale = dist / lastDist;
          setZoom((z) => Math.min(2, Math.max(0.2, z * scale)));
        }
        lastDist = dist;
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  if (error) return <p className="error-message">{error}</p>;
  if (!graph || !layout) return <p className="status-message">Loading knowledge graph…</p>;

  if (graph.nodes.length === 0) {
    return (
      <div className="empty-state">
        <p className="status-message">
          No concepts mapped yet — generate a course to start building this graph.
        </p>
      </div>
    );
  }

  const { positioned, positionedEdges, orphans } = layout;
  const pad = 100;
  const minX = Math.min(...positioned.map((n) => n.x - n.r)) - pad;
  const maxX = Math.max(...positioned.map((n) => n.x + n.r)) + pad;
  const minY = Math.min(...positioned.map((n) => n.y - n.r)) - pad;
  const maxY = Math.max(...positioned.map((n) => n.y + n.r)) + pad;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="graph-view">
      <div className="page-header">
        <h1 className="page-header-title">Knowledge Graph</h1>
        <p className="page-header-sub">Every concept you've learned, connected.</p>
      </div>

      <div className="graph-toolbar">
        <div className="graph-zoom-controls">
          <button className="button secondary" onClick={() => setZoom((z) => Math.min(2, z + 0.2))}>
            +
          </button>
          <button className="button secondary" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>
            −
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setZoom(1);
              recenter();
            }}
          >
            Recenter
          </button>
        </div>
        <div className="graph-legend">
          <span className="legend-item">
            <span className="legend-dot mastered" /> Mastered
          </span>
          <span className="legend-item">
            <span className="legend-dot learning" /> Learning
          </span>
          <span className="legend-item">
            <span className="legend-dot new" /> New
          </span>
        </div>
      </div>

      <div className="graph-canvas-wrap" ref={wrapRef}>
        <svg
          ref={svgRef}
          className="graph-svg"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          viewBox={`${minX} ${minY} ${width} ${height}`}
          width={width}
          height={height}
        >
          {positionedEdges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="graph-edge" />
          ))}
          {positioned.map((n) => (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              className={`graph-node-group ${masteryClass(n.times_encountered)}`}
              onMouseEnter={(e) => setHover({ node: n, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover({ node: n, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
            >
              <circle r={n.r} className="graph-node-circle" />
              <foreignObject x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2}>
                <div className="graph-node-label">{n.label}</div>
              </foreignObject>
            </g>
          ))}
        </svg>
      </div>

      {orphans.length > 0 && (
        <div className="graph-column">
          <h3 className="graph-column-title">Unlinked concepts</h3>
          {orphans.map((n) => (
            <div className={`graph-node ${masteryClass(n.times_encountered)}`} key={n.id}>
              <span className="graph-node-label">{n.label}</span>
              <span className="graph-node-count">×{n.times_encountered}</span>
            </div>
          ))}
        </div>
      )}

      {hover && (
        <div className="graph-tooltip" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <strong>{hover.node.label}</strong>
          <span className="graph-tooltip-tier">{hover.node.tier}</span>
          <p>{hover.node.description}</p>
          <span className="graph-tooltip-count">Seen {hover.node.times_encountered}×</span>
        </div>
      )}
    </div>
  );
}
