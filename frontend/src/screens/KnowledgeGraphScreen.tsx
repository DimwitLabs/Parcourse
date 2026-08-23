import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from "d3-force";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { download } from "../lib/download";
import { withLightPalette } from "../lib/palette";
import { useAuth } from "../lib/auth";
import { useEscapeKey } from "../lib/useEscapeKey";
import { gravatarUrl, userInitials } from "../lib/gravatar";
import type { NamedUser } from "../lib/gravatar";

type Tier = "you" | "domain" | "field" | "topic" | "skill";
type CourseRef = { id: string; title: string };
type Node = {
  id: string;
  tier: Tier;
  label: string;
  description: string;
  mastery_score: number;
  courses: CourseRef[];
};
type Edge = { source_id: string; target_id: string; edge_type: string };
type Graph = { nodes: Node[]; edges: Edge[] };

type Granularity = "field" | "topic" | "skill";

const YOU_ID = "__you__";
const TIER_ORDER: Tier[] = ["you", "domain", "field", "topic", "skill"];
const NODE_RADIUS: Record<Tier, number> = { you: 68, domain: 72, field: 58, topic: 40, skill: 26 };

function tierIncluded(tier: Tier, granularity: Granularity): boolean {
  if (tier === "you" || tier === "domain") return true;
  const cutoff = TIER_ORDER.indexOf(granularity as Tier);
  return TIER_ORDER.indexOf(tier) <= cutoff;
}

// Mirrors _EXPOSURE_MASTERY in backend/services/knowledge_graph.py.
const EXPOSURE_MASTERY = 0.2;
const DRAG_SLOP_PX = 6;

function masteryClass(score: number): "mastered" | "learning" | "new" {
  if (score >= 0.9) return "mastered";
  if (score > EXPOSURE_MASTERY) return "learning";
  return "new";
}

function computeEffectiveMastery(nodes: Node[], edges: Edge[]): Map<string, number> {
  const scoreMap = new Map(nodes.map((n) => [n.id, n.mastery_score]));

  const children = new Map<string, string[]>();
  for (const e of edges) {
    if (e.edge_type === "belongs_to") {
      const list = children.get(e.target_id) ?? [];
      list.push(e.source_id);
      children.set(e.target_id, list);
    }
  }
  const effective = new Map<string, number>();
  const TIER_CALC_ORDER: Tier[] = ["skill", "topic", "field"];
  const byTier = new Map<Tier, Node[]>();
  for (const t of TIER_CALC_ORDER) byTier.set(t, []);
  for (const n of nodes) {
    if (TIER_CALC_ORDER.includes(n.tier)) byTier.get(n.tier)!.push(n);
  }
  for (const tier of TIER_CALC_ORDER) {
    for (const n of byTier.get(tier)!) {
      const kids = (children.get(n.id) ?? []).filter((id) => effective.has(id) || scoreMap.has(id));
      if (kids.length > 0) {
        const min = kids.reduce((acc, id) => Math.min(acc, effective.get(id) ?? scoreMap.get(id) ?? 0), 1);
        effective.set(n.id, min);
      } else {
        effective.set(n.id, scoreMap.get(n.id) ?? 0);
      }
    }
  }
  return effective;
}

type SimNode = Node & { x: number; y: number; vx: number; vy: number; r: number; fx?: number | null; fy?: number | null };
type SimEdge = { source: SimNode; target: SimNode; edge_type: string };

function displayName(u: NamedUser): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.email;
}

const YOU_NODE: Node = {
  id: YOU_ID,
  tier: "you",
  label: "You",
  description: "Cogito, ergo sum",
  mastery_score: 1,
  courses: [],
};

type LiveSim = ReturnType<typeof forceSimulation<SimNode>>;

function runSimulation(
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number,
  centre: Node = YOU_NODE
): { sim: LiveSim; nodes: SimNode[]; edges: SimEdge[] } {
  const youSimNode: SimNode = { ...centre, x: 0, y: 0, vx: 0, vy: 0, r: NODE_RADIUS.you, fx: 0, fy: 0 };

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
    .force("collide", forceCollide<SimNode>((n) => n.r + 8).strength(1.0))
    .alphaDecay(0.02)
    .stop();

  for (let i = 0; i < 100; i++) sim.tick();

  return { sim, nodes: simNodes, edges: simEdges };
}

const FONT_SIZES: Record<Tier, number> = { you: 14, domain: 14, field: 13, topic: 11, skill: 9 };
const FONT_WEIGHT: Record<Tier, number> = { you: 800, domain: 700, field: 800, topic: 700, skill: 600 };

function wrapText(text: string, r: number, fontSize: number): string[] {
  const maxChars = Math.max(4, Math.floor((r * 1.55) / (fontSize * 0.58)));
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars - 1) + "…" : word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 3) {
    lines.splice(3);
    lines[2] = lines[2].replace(/..$/, "…");
  }
  return lines;
}

function inlineStylesToClone(original: SVGSVGElement, clone: SVGSVGElement) {
  const origEls = Array.from(original.querySelectorAll("*"));
  const cloneEls = Array.from(clone.querySelectorAll("*"));
  const PROPS = ["fill", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "opacity", "font-size", "font-weight", "font-family"];
  origEls.forEach((orig, i) => {
    const clEl = cloneEls[i] as SVGElement | null;
    if (!clEl || !("style" in clEl)) return;
    const cs = window.getComputedStyle(orig);
    for (const prop of PROPS) {
      const val = cs.getPropertyValue(prop);
      if (val) clEl.setAttribute(prop, val);
    }
  });
}

async function inlineImages(clone: SVGSVGElement): Promise<void> {
  const images = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    images.map(async (img) => {
      const href = img.getAttribute("href") ?? img.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      try {
        const blob = await fetch(href, { mode: "cors" }).then((r) => r.blob());
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute("href", data);
        img.removeAttribute("xlink:href");
      } catch {
        img.remove();
      }
    })
  );
}

async function prepareClone(svgEl: SVGSVGElement): Promise<SVGSVGElement> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("style");
  withLightPalette(() => inlineStylesToClone(svgEl, clone));
  await inlineImages(clone);
  return clone;
}

async function exportSvg(svgEl: SVGSVGElement) {
  const clone = await prepareClone(svgEl);
  const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
  download(blob, "knowledge-graph.svg");
}

async function exportPng(svgEl: SVGSVGElement) {
  const clone = await prepareClone(svgEl);
  const bbox = svgEl.getBBox();
  const pad = 40;
  const w = bbox.width + pad * 2;
  const h = bbox.height + pad * 2;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => {
      if (b) download(b, "knowledge-graph.png");
    }, "image/png");
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export default function KnowledgeGraphScreen() {
  const { token, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarErr, setAvatarErr] = useState(false);
  const [params] = useSearchParams();
  const viewingUserId = params.get("user");

  const [subject, setSubject] = useState<NamedUser | null>(null);

  const owner = subject ?? user ?? null;

  useEffect(() => {
    if (!viewingUserId || user?.role !== "admin") {
      setSubject(null);
      return;
    }
    apiFetch("/users", token)
      .then((list: (NamedUser & { id: string })[]) =>
        setSubject(list.find((u) => u.id === viewingUserId) ?? null))
      .catch(() => setSubject(null));
  }, [viewingUserId, user?.role, token]);

  useEffect(() => {
    if (!owner?.email) return;
    setAvatarErr(false);
    gravatarUrl(owner.email, 160).then(setAvatarUrl);
  }, [owner?.email]);

  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("topic");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ node: Node; x: number; y: number; pinned: boolean } | null>(null);
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [simData, setSimData] = useState<{ nodes: SimNode[]; edges: SimEdge[] } | null>(null);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  const simInstanceRef = useRef<LiveSim | null>(null);

  useEscapeKey(!!confirming, () => { if (!forgetting) setConfirming(null); });

  const stackRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<{ left: number; top: number } | null>(null);

  // Pinning grows the card by a row, which near an edge would push that row off
  // the screen, so the card moves to where it fits instead.
  useLayoutEffect(() => {
    if (!tooltip) {
      setPlaced(null);
      return;
    }
    const stack = stackRef.current;
    if (!stack) return;
    const { width, height } = stack.getBoundingClientRect();
    const margin = 12;
    let left = tooltip.x + 20;
    let top = tooltip.y + 16;
    if (left + width > window.innerWidth - margin) left = tooltip.x - 20 - width;
    if (top + height > window.innerHeight - margin) top = tooltip.y - 16 - height;
    setPlaced({
      left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
    });
  }, [tooltip]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const draggingNode = useRef<SimNode | null>(null);
  const pendingDrag = useRef<SimNode | null>(null);
  const dragStartClient = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const path =
      viewingUserId && user?.role === "admin"
        ? `/knowledge-graph/users/${viewingUserId}`
        : "/knowledge-graph";
    apiFetch(path, token)
      .then(setGraph)
      .catch((err) => setError(String(err.message ?? err)));
  }, [token, viewingUserId, user]);

  // What the server will take with it, so the warning can name it beforehand.
  // Mirrors _falling in backend/routers/knowledge_graph.py.
  function falling(node: Node): Node[] {
    if (!graph) return [];
    const parents = new Map<string, Set<string>>();
    const children = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
      if (edge.edge_type !== "belongs_to") continue;
      parents.set(edge.source_id, (parents.get(edge.source_id) ?? new Set()).add(edge.target_id));
      children.set(edge.target_id, (children.get(edge.target_id) ?? new Set()).add(edge.source_id));
    }

    const going = new Set([node.id]);
    let frontier = [node.id];
    while (frontier.length > 0) {
      const below: string[] = [];
      for (const above of frontier) {
        for (const child of children.get(above) ?? []) {
          if (going.has(child)) continue;
          going.add(child);
          below.push(child);
        }
      }
      frontier = below;
    }

    for (let spared = true; spared; ) {
      spared = false;
      for (const candidate of going) {
        if (candidate === node.id) continue;
        const held = [...(parents.get(candidate) ?? [])].some((parent) => !going.has(parent));
        if (held) {
          going.delete(candidate);
          spared = true;
          break;
        }
      }
    }
    return graph.nodes.filter((n) => going.has(n.id));
  }

  async function forget(node: Node) {
    setForgetting(node.id);
    try {
      const { forgotten } = await apiFetch(`/knowledge-graph/nodes/${node.id}`, token, { method: "DELETE" });
      const gone = new Set<string>(forgotten);
      setGraph((current) =>
        current
          ? {
              nodes: current.nodes.filter((n) => !gone.has(n.id)),
              edges: current.edges.filter((e) => !gone.has(e.source_id) && !gone.has(e.target_id)),
            }
          : current,
      );
      setConfirming(null);
      setTooltip(null);
      toast(
        gone.size > 1
          ? `${node.label} and ${gone.size - 1} concept${gone.size === 2 ? "" : "s"} under it were removed from your graph.`
          : `${node.label} was removed from your graph.`,
        "success",
      );
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setForgetting(null);
    }
  }

  useEffect(() => {
    if (!graph) return;

    simInstanceRef.current?.stop();

    const filtered = graph.nodes.filter((n) => tierIncluded(n.tier, granularity));
    const filteredIds = new Set(filtered.map((n) => n.id));
    const filteredEdges = graph.edges.filter(
      (e) => filteredIds.has(e.source_id) && filteredIds.has(e.target_id)
    );

    const centre: Node = subject
      ? { ...YOU_NODE, label: displayName(subject), description: subject.email }
      : YOU_NODE;
    const { sim, nodes, edges } = runSimulation(filtered, filteredEdges, 900, 700, centre);
    simInstanceRef.current = sim;

    setSimData({ nodes, edges });
    setPan({ x: 0, y: 0 });
    setZoom(1);

    sim.alphaTarget(0).restart();

    let rafId: number;
    let last = 0;
    function loop(t: number) {
      if (t - last >= 33) { last = t; forceUpdate(); }  // 33ms ≈ 30fps
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      sim.stop();
    };
  }, [graph, granularity, subject]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !simData) return;

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
  }, [simData]);

  function clientToSvg(clientX: number, clientY: number) {
    if (!wrapRef.current) return { x: 0, y: 0 };
    const rect = wrapRef.current.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    const rx = clientX - rect.left;
    const ry = clientY - rect.top;
    // Undoes translate(pan) scale(zoom) with transform-origin: center, then
    // maps pixels onto the -500..500 x -400..400 viewBox.
    const nativeX = (rx - pan.x - W / 2) / zoom + W / 2;
    const nativeY = (ry - pan.y - H / 2) / zoom + H / 2;

    return { x: (nativeX / W) * 1000 - 500, y: (nativeY / H) * 800 - 400 };
  }

  // Grabbing the node on mousedown made every click on a small one shove it
  // across the canvas, so it is only picked up once the pointer has travelled.
  function onNodeMouseDown(e: React.MouseEvent, n: SimNode) {
    if (n.tier === "you") return;
    e.stopPropagation();
    dragStartClient.current = { x: e.clientX, y: e.clientY };
    pendingDrag.current = n;
  }

  function startDrag(n: SimNode) {
    pendingDrag.current = null;
    draggingNode.current = n;
    n.fx = n.x;
    n.fy = n.y;
    simInstanceRef.current?.alphaTarget(0.3).restart();
    setTooltip(null);
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).closest(".graph-node-group")) return;
    setTooltip((t) => (t?.pinned ? null : t));
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    const waiting = pendingDrag.current;
    if (waiting) {
      const dx = e.clientX - dragStartClient.current.x;
      const dy = e.clientY - dragStartClient.current.y;
      if (dx * dx + dy * dy <= DRAG_SLOP_PX * DRAG_SLOP_PX) return;
      startDrag(waiting);
    }
    if (draggingNode.current) {
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      draggingNode.current.fx = x;
      draggingNode.current.fy = y;
      return;
    }
    if (!isPanning.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }
  function onMouseUp() {
    pendingDrag.current = null;
    if (draggingNode.current) {
      const node = draggingNode.current;
      node.fx = null;
      node.fy = null;
      draggingNode.current = null;
      simInstanceRef.current?.alphaTarget(0);
      return;
    }
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
  const effectiveMastery = simData && graph ? computeEffectiveMastery(simData.nodes, graph.edges) : new Map<string, number>();

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

      {!graph || !simData ? (
        <p className="status-message">Loading knowledge graph…</p>
      ) : (
        <>
          <div className="graph-toolbar">
            <div className="graph-granularity-pills">
              {GRANULARITY_PILLS.map(({ value, label }, i) => (
                <span key={value} className="graph-pill-wrap">
                  {i > 0 && (
                    <span className="graph-pill-arrow" aria-hidden="true">
                      <svg width="6" height="9" viewBox="0 0 6 9" fill="none">
                        <path d="M1 1.5l3.5 3L1 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
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
                <button className="button secondary tip" data-tip="Zoom in" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button className="button secondary tip" data-tip="Zoom out" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
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
              overflow="visible"
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
                {simData.nodes.map((n) => (
                  <clipPath key={`cp-${n.id}`} id={`nc-${n.id}`}>
                    <circle r={n.r * 0.84} />
                  </clipPath>
                ))}
              </defs>

              {simData.edges.map((e, i) => {
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

              {simData.nodes.map((n, idx) => {
                const mc = n.tier === "you" ? "mastered" : masteryClass(effectiveMastery.get(n.id) ?? n.mastery_score);
                const isField = n.tier === "field";
                const isYou = n.tier === "you";
                const isPinned = tooltip?.pinned && tooltip.node.id === n.id;
                const fontSize = FONT_SIZES[n.tier];
                const showAvatar = isYou && !!avatarUrl && !avatarErr;
                const lines = wrapText(isYou ? userInitials(owner) || "You" : n.label, n.r, fontSize);
                const lineHeight = fontSize * 1.32;
                const textFill = mc === "new" && !isYou ? "var(--color-secondary)" : "var(--color-node-label)";
                const clipId = `nc-${n.id}`;
                const enterDelay = `${Math.min(idx * 0.035, 0.5).toFixed(3)}s`;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    className={`graph-node-group ${mc} tier-${n.tier}${isPinned ? " pinned" : ""}${hovered === n.id && !isYou ? " hovered" : ""}`}
                    onMouseDown={(e) => onNodeMouseDown(e, n)}
                    onMouseEnter={(e) => { setHovered(n.id); if (!tooltip?.pinned && !draggingNode.current) setTooltip({ node: n, x: e.clientX, y: e.clientY, pinned: false }); }}
                    onMouseMove={(e) => { if (!tooltip?.pinned && !draggingNode.current) setTooltip({ node: n, x: e.clientX, y: e.clientY, pinned: false }); }}
                    onMouseLeave={() => { setHovered((h) => (h === n.id ? null : h)); if (!tooltip?.pinned) setTooltip(null); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const dx = e.clientX - dragStartClient.current.x;
                      const dy = e.clientY - dragStartClient.current.y;
                      if (dx * dx + dy * dy > DRAG_SLOP_PX * DRAG_SLOP_PX) return;
                      setTooltip((t) =>
                        t?.pinned && t.node.id === n.id
                          ? null
                          : { node: n, x: e.clientX, y: e.clientY, pinned: true }
                      );
                    }}
                  >
                    <g
                      className="graph-node-scale-wrap"
                      style={{ animationDelay: enterDelay }}
                    >
                      <circle
                        r={n.r}
                        className="graph-node-circle"
                        filter={isYou || isField ? "url(#glow-field)" : mc === "mastered" ? "url(#glow-mastered)" : undefined}
                      />
                      {!isYou && <circle r={n.r + 5} className="graph-node-ring" />}
                      {!isYou && <circle r={n.r + 8} className="graph-node-hit" />}
                      {showAvatar ? (
                        <image
                          href={avatarUrl!}
                          x={-n.r * 0.84}
                          y={-n.r * 0.84}
                          width={n.r * 1.68}
                          height={n.r * 1.68}
                          clipPath={`url(#${clipId})`}
                          preserveAspectRatio="xMidYMid slice"
                          onError={() => setAvatarErr(true)}
                          style={{ userSelect: "none", pointerEvents: "none" }}
                        />
                      ) : (
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={fontSize}
                          fontWeight={FONT_WEIGHT[n.tier]}
                          fill={textFill}
                          clipPath={`url(#${clipId})`}
                          style={{ fontFamily: "inherit", userSelect: "none", pointerEvents: "none" }}
                        >
                          {lines.map((line, i) => (
                            <tspan
                              key={i}
                              x={0}
                              dy={i === 0 ? -(lines.length - 1) * lineHeight / 2 : lineHeight}
                            >
                              {line}
                            </tspan>
                          ))}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </svg>
            {graph.nodes.length === 0 && (
              <div className="graph-empty-hint">
                <span>Generate a course to start building your knowledge graph.</span>
              </div>
            )}
          </div>

          <div className="graph-legend-row">
            <div className="graph-legend">
              <span className="legend-item">
                <span className="legend-dot mastered" /> Mastered
                <span className="legend-tip">Scored 90% or above on this course's quiz</span>
              </span>
              <span className="legend-item">
                <span className="legend-dot learning" /> Learning
                <span className="legend-tip">Quiz attempted but scored below 90%</span>
              </span>
              <span className="legend-item">
                <span className="legend-dot new" /> New
                <span className="legend-tip">Course not yet quizzed</span>
              </span>
            </div>
          </div>
        </>
      )}

      {tooltip && (
        <div
          ref={stackRef}
          className={`graph-tooltip-stack${tooltip.pinned ? " pinned" : ""}`}
          style={placed ?? { left: tooltip.x + 20, top: tooltip.y + 16 }}
          onMouseEnter={() => { if (!tooltip.pinned) setTooltip(null); }}
        >
          <div className={`graph-tooltip${tooltip.pinned ? " pinned" : ""}`}>
          {tooltip.pinned && (
            <button className="graph-tooltip-close" onClick={() => setTooltip(null)} aria-label="Close">×</button>
          )}
          <div className="graph-tooltip-header">
            <strong className="graph-tooltip-label">{tooltip.node.label}</strong>
            {tooltip.node.tier !== "you" && <span className="graph-tooltip-tier">{tooltip.node.tier}</span>}
          </div>
          {tooltip.node.description && (
            <p className="graph-tooltip-desc">
              {tooltip.node.tier === "you" ? <em>{tooltip.node.description}</em> : tooltip.node.description}
            </p>
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
          {tooltip.pinned && tooltip.node.tier !== "you" && !viewingUserId && (
            <button
              className="graph-tooltip-forget"
              onClick={() => setConfirming(tooltip.node)}
              disabled={forgetting === tooltip.node.id}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" />
              </svg>
              {forgetting === tooltip.node.id ? "Forgetting…" : "Forget this concept"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>
      )}

      {confirming && (() => {
        const going = falling(confirming);
        const others = going.filter((n) => n.id !== confirming.id);
        return (
          <div className="modal-overlay" onClick={() => !forgetting && setConfirming(null)}>
            <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
              <h2 className="graph-confirm-title">Forget {confirming.label}?</h2>
              <p className="graph-confirm-body">
                {others.length === 0
                  ? "This drops the concept from your graph. It comes back if another course teaches it."
                  : others.length === 1
                    ? "One other concept belongs to this one and to nothing else, so it goes too:"
                    : `${others.length} other concepts belong to this one and to nothing else, so they go too:`}
              </p>
              {others.length > 0 && (
                <ul className="graph-confirm-list">
                  {others.map((n) => (
                    <li key={n.id}>
                      {n.label}
                      <span className="graph-confirm-tier">{n.tier}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="graph-confirm-actions">
                <button className="button secondary" onClick={() => setConfirming(null)} disabled={!!forgetting}>
                  {others.length === 0 ? "Keep it" : "Keep them"}
                </button>
                <button className="button danger" onClick={() => forget(confirming)} disabled={!!forgetting}>
                  {forgetting ? "Forgetting…" : others.length === 0 ? "Forget it" : "Forget them"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
