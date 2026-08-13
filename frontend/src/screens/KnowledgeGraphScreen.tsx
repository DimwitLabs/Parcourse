import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from "d3-force";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tier = "you" | "domain" | "field" | "topic" | "skill";
type CourseRef = { id: string; title: string };
type Node = {
  id: string;
  tier: Tier;
  label: string;
  description: string;
  mastery_score: number;
  times_encountered: number;
  courses: CourseRef[];
};
type Edge = { source_id: string; target_id: string; edge_type: string };
type Graph = { nodes: Node[]; edges: Edge[] };

type Granularity = "field" | "topic" | "skill";

const YOU_ID = "__you__";
const TIER_ORDER: Tier[] = ["you", "domain", "field", "topic", "skill"];
const NODE_RADIUS: Record<Tier, number> = { you: 52, domain: 56, field: 44, topic: 30, skill: 20 };

function tierIncluded(tier: Tier, granularity: Granularity): boolean {
  if (tier === "you" || tier === "domain") return true;
  const cutoff = TIER_ORDER.indexOf(granularity as Tier);
  return TIER_ORDER.indexOf(tier) <= cutoff;
}

function masteryClass(timesEncountered: number): "mastered" | "learning" | "new" {
  if (timesEncountered >= 4) return "mastered";
  if (timesEncountered >= 2) return "learning";
  return "new";
}

type SimNode = Node & { x: number; y: number; vx: number; vy: number; r: number; fx?: number | null; fy?: number | null };
type SimEdge = { source: SimNode; target: SimNode; edge_type: string };

const YOU_NODE: Node = {
  id: YOU_ID,
  tier: "you",
  label: "You",
  description: "Your learning journey — every course, concept, and connection starts here.",
  mastery_score: 1,
  times_encountered: 0,
  courses: [],
};

function runSimulation(
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number
): { nodes: SimNode[]; edges: SimEdge[] } {
  const youSimNode: SimNode = { ...YOU_NODE, x: 0, y: 0, vx: 0, vy: 0, r: NODE_RADIUS.you, fx: 0, fy: 0 };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const regularSimNodes: SimNode[] = nodes.map((n) => ({
    ...n,
    x: (Math.random() - 0.5) * width * 0.5,
    y: (Math.random() - 0.5) * height * 0.5,
    vx: 0,
    vy: 0,
    r: NODE_RADIUS[n.tier],
  }));

  const simNodes: SimNode[] = [youSimNode, ...regularSimNodes];
  const simNodeById = new Map(simNodes.map((n) => [n.id, n]));

  const simEdges: SimEdge[] = edges
    .filter((e) => byId.has(e.source_id) && byId.has(e.target_id))
    .map((e) => ({
      source: simNodeById.get(e.source_id)!,
      target: simNodeById.get(e.target_id)!,
      edge_type: e.edge_type,
    }));

  // Connect all field nodes to "You"
  for (const n of regularSimNodes) {
    if (n.tier === "field") {
      simEdges.push({ source: youSimNode, target: n, edge_type: "belongs_to" });
    }
  }

  const tierCharge: Record<Tier, number> = { you: -1200, domain: -800, field: -600, topic: -350, skill: -180 };

  const sim = forceSimulation<SimNode>(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimEdge>(simEdges)
        .id((n) => n.id)
        .distance((e) => {
          const s = e.source as SimNode;
          const t = e.target as SimNode;
          const base = s.r + t.r + 55;
          return s.tier === "you" || t.tier === "you" ? base + 30 : base;
        })
        .strength(0.45)
    )
    .force("charge", forceManyBody<SimNode>().strength((n) => tierCharge[n.tier]))
    .force("collide", forceCollide<SimNode>((n) => n.r + 14).strength(0.85))
    .stop();

  for (let i = 0; i < 320; i++) sim.tick();

  return { nodes: simNodes, edges: simEdges };
}

function exportSvg(svgEl: SVGSVGElement) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("style");
  const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "knowledge-graph.svg";
  a.click();
  URL.revokeObjectURL(url);
}

function exportPng(svgEl: SVGSVGElement) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("style");
  const bbox = svgEl.getBBox();
  const pad = 40;
  const w = bbox.width + pad * 2;
  const h = bbox.height + pad * 2;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`);

  const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.fillStyle = "#1b1c1a";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "knowledge-graph.png";
      a.click();
    }, "image/png");
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export default function KnowledgeGraphScreen() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const viewingUserId = params.get("user");

  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("topic");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ node: Node; x: number; y: number; pinned: boolean } | null>(null);
  const [sim, setSim] = useState<{ nodes: SimNode[]; edges: SimEdge[] } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const path =
      viewingUserId && user?.role === "admin"
        ? `/knowledge-graph/users/${viewingUserId}`
        : "/knowledge-graph";
    apiFetch(path, token)
      .then(setGraph)
      .catch((err) => setError(String(err.message ?? err)));
  }, [token, viewingUserId, user]);

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;
    const filtered = graph.nodes.filter((n) => tierIncluded(n.tier, granularity));
    const filteredIds = new Set(filtered.map((n) => n.id));
    const filteredEdges = graph.edges.filter(
      (e) => filteredIds.has(e.source_id) && filteredIds.has(e.target_id)
    );
    const result = runSimulation(filtered, filteredEdges, 900, 700);
    setSim(result);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [graph, granularity]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !sim) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((z) => Math.min(3, Math.max(0.2, z + delta)));
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
          setZoom((z) => Math.min(3, Math.max(0.2, z * (dist / lastDist))));
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
  }, [sim]);

  function onCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).closest(".graph-node-group")) return;
    setTooltip((t) => (t?.pinned ? null : t));
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isPanning.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }
  function onMouseUp() {
    isPanning.current = false;
  }

  function nodeCounts(): Record<Granularity, number> {
    if (!graph) return { field: 0, topic: 0, skill: 0 };
    return {
      field: graph.nodes.filter((n) => n.tier === "field").length,
      topic: graph.nodes.filter((n) => n.tier === "field" || n.tier === "topic").length,
      skill: graph.nodes.filter((n) => n.tier !== "domain" && n.tier !== "you").length,
    };
  }
  const counts = nodeCounts();

  if (error) return <p className="error-message" style={{ padding: "2rem" }}>{error}</p>;

  const GRANULARITY_PILLS: { value: Granularity; label: string }[] = [
    { value: "field", label: "Fields" },
    { value: "topic", label: "Topics" },
    { value: "skill", label: "Skills" },
  ];


  return (
    <div className="graph-view">
      <div className="page-header">
        <h1 className="page-header-title">Knowledge Graph</h1>
        <p className="page-header-sub">Every concept you've learned, connected.</p>
      </div>

      {!graph || !sim ? (
        <p className="status-message">Loading knowledge graph…</p>
      ) : graph.nodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <h2 className="empty-state-title">No concepts mapped yet</h2>
          <p className="empty-state-body">Generate a course to start building your knowledge graph.</p>
        </div>
      ) : (
        <>
          <div className="graph-toolbar">
            <div className="graph-granularity-pills">
              {GRANULARITY_PILLS.map(({ value, label }, i) => (
                <span key={value} className="graph-pill-wrap">
                  {i > 0 && <span className="graph-pill-arrow">›</span>}
                  <button
                    className={`graph-pill${granularity === value ? " active" : ""}`}
                    onClick={() => setGranularity(value)}
                  >
                    {label}
                    <span className="graph-pill-count">{counts[value]}</span>
                  </button>
                </span>
              ))}
            </div>
            <div className="graph-toolbar-right">
              <div className="graph-zoom-controls">
                <button className="button secondary" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>+</button>
                <button className="button secondary" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}>−</button>
                <button className="button secondary" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
              </div>
              <div className="graph-export-controls">
                <button className="button secondary" onClick={() => svgRef.current && exportSvg(svgRef.current)}>SVG</button>
                <button className="button secondary" onClick={() => svgRef.current && exportPng(svgRef.current)}>PNG</button>
              </div>
            </div>
          </div>

          <div
            className="graph-canvas-wrap"
            ref={wrapRef}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <svg
              ref={svgRef}
              className="graph-svg"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center", cursor: isPanning.current ? "grabbing" : "grab" }}
              viewBox="-500 -400 1000 800"
              width="100%"
              height="100%"
            >
              <defs>
                <filter id="glow-mastered">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-field">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {sim.edges.map((e, i) => {
                const s = e.source;
                const t = e.target;
                return (
                  <line
                    key={i}
                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    className={`graph-edge graph-edge-${e.edge_type}`}
                  />
                );
              })}

              {sim.nodes.map((n) => {
                const mc = n.tier === "you" ? "mastered" : masteryClass(n.times_encountered);
                const isField = n.tier === "field";
                const isYou = n.tier === "you";
                const isPinned = tooltip?.pinned && tooltip.node.id === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    className={`graph-node-group ${mc} tier-${n.tier}${isPinned ? " pinned" : ""}`}
                    onMouseEnter={(e) => { if (!tooltip?.pinned) setTooltip({ node: n, x: e.clientX, y: e.clientY, pinned: false }); }}
                    onMouseMove={(e) => { if (!tooltip?.pinned) setTooltip({ node: n, x: e.clientX, y: e.clientY, pinned: false }); }}
                    onMouseLeave={() => { if (!tooltip?.pinned) setTooltip(null); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTooltip((t) =>
                        t?.pinned && t.node.id === n.id
                          ? null
                          : { node: n, x: e.clientX, y: e.clientY, pinned: true }
                      );
                    }}
                  >
                    <circle
                      r={n.r}
                      className="graph-node-circle"
                      filter={isYou ? "url(#glow-field)" : isField ? "url(#glow-field)" : mc === "mastered" ? "url(#glow-mastered)" : undefined}
                    />
                    <foreignObject x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2}>
                      <div className={`graph-node-label tier-${n.tier}`}>{n.label}</div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="graph-legend-row">
            <div className="graph-legend">
              <span className="legend-item"><span className="legend-dot mastered" /> Mastered</span>
              <span className="legend-item"><span className="legend-dot learning" /> Learning</span>
              <span className="legend-item"><span className="legend-dot new" /> New</span>
            </div>
          </div>
        </>
      )}

      {tooltip && (
        <div
          className={`graph-tooltip${tooltip.pinned ? " pinned" : ""}`}
          style={{ left: tooltip.x + 20, top: tooltip.y + 16 }}
          onMouseEnter={() => { if (!tooltip.pinned) setTooltip(null); }}
        >
          {tooltip.pinned && (
            <button className="graph-tooltip-close" onClick={() => setTooltip(null)} aria-label="Close">×</button>
          )}
          <div className="graph-tooltip-header">
            <strong className="graph-tooltip-label">{tooltip.node.label}</strong>
            {tooltip.node.tier !== "you" && <span className="graph-tooltip-tier">{tooltip.node.tier}</span>}
          </div>
          {tooltip.node.description && (
            <p className="graph-tooltip-desc">{tooltip.node.description}</p>
          )}
          {tooltip.node.courses.length > 0 && (
            <div className="graph-tooltip-courses">
              <span className="graph-tooltip-courses-label">Seen in</span>
              {tooltip.node.courses.map((c) => (
                <Link key={c.id} to={`/course/${c.id}`} className="graph-tooltip-course-link">
                  {c.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
