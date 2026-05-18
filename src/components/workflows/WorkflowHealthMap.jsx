import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, RotateCcw, AlertTriangle, XCircle, CheckCircle2, Info } from "lucide-react";

// ── Status colour palette ──────────────────────────────────────────────────
const STATUS = {
  cycle_detected: { fill: "#fed7aa", stroke: "#ea580c", text: "#9a3412", label: "Cycle" },
  missing_step:   { fill: "#e9d5ff", stroke: "#7c3aed", text: "#4c1d95", label: "Missing" },
  terminal:       { fill: "#e2e8f0", stroke: "#64748b", text: "#1e293b", label: "Terminal" },
  reportable:     { fill: "#fee2e2", stroke: "#dc2626", text: "#7f1d1d", label: "Reportable" },
  non_reportable: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d", label: "Non-reportable" },
  pending_review: { fill: "#fef9c3", stroke: "#ca8a04", text: "#713f12", label: "Pending" },
  excluded:       { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569", label: "Excluded" },
  healthy:        { fill: "#f1f5f9", stroke: "#94a3b8", text: "#334155", label: "Step" },
};

const OUTCOME_PRIORITY = ["missing_step", "cycle_detected", "terminal", "reportable", "non_reportable", "pending_review", "excluded", "healthy"];

function worstStatus(statuses) {
  for (const s of OUTCOME_PRIORITY) {
    if (statuses.has(s)) return s;
  }
  return "healthy";
}

// ── Compute per-step metrics from paths_summary ───────────────────────────
function computeStepMetrics(pathsSummary) {
  // stepId → { outcomes: Set, pathCount, incomingFrom: Set, outgoingTo: Set }
  const metrics = {};

  const ensure = (id) => {
    if (!metrics[id]) metrics[id] = { outcomes: new Set(), pathCount: 0, incomingFrom: new Set(), outgoingTo: new Set() };
  };

  pathsSummary.forEach(path => {
    const ids = path.step_ids;
    ids.forEach((sid, i) => {
      ensure(sid);
      metrics[sid].pathCount++;
      metrics[sid].outcomes.add(path.final_status);
      if (i > 0) metrics[sid].incomingFrom.add(ids[i - 1]);
      if (i < ids.length - 1) metrics[sid].outgoingTo.add(ids[i + 1]);
    });
  });

  return metrics;
}

// ── Build ordered list of unique steps preserving workflow order ──────────
function buildOrderedSteps(pathsSummary, workflowSteps) {
  // Prefer workflow step order if available
  if (workflowSteps?.length > 0) {
    return workflowSteps.map(s => s.step_id).filter(Boolean);
  }
  // Fallback: derive from paths (BFS-style ordering by first appearance)
  const seen = new Set();
  const ordered = [];
  pathsSummary.forEach(p => {
    p.step_ids.forEach(sid => {
      if (!seen.has(sid)) { seen.add(sid); ordered.push(sid); }
    });
  });
  return ordered;
}

// ── Build all unique edges ─────────────────────────────────────────────────
function buildEdges(pathsSummary) {
  const edgeMap = {}; // "from→to" → { count, outcomes: Set }
  pathsSummary.forEach(path => {
    const ids = path.step_ids;
    for (let i = 0; i < ids.length - 1; i++) {
      const key = `${ids[i]}→${ids[i + 1]}`;
      if (!edgeMap[key]) edgeMap[key] = { from: ids[i], to: ids[i + 1], count: 0, outcomes: new Set() };
      edgeMap[key].count++;
      edgeMap[key].outcomes.add(path.final_status);
    }
  });
  return Object.values(edgeMap);
}

// ── Layout: simple grid left-to-right, wrapping every N columns ──────────
const COL = 5;
const NODE_W = 170;
const NODE_H = 56;
const GAP_X = 60;
const GAP_Y = 70;

function layout(steps) {
  const positions = {};
  steps.forEach((sid, i) => {
    const col = i % COL;
    const row = Math.floor(i / COL);
    positions[sid] = {
      x: col * (NODE_W + GAP_X),
      y: row * (NODE_H + GAP_Y),
    };
  });
  const rows = Math.ceil(steps.length / COL);
  return { positions, width: COL * (NODE_W + GAP_X) - GAP_X, height: rows * (NODE_H + GAP_Y) - GAP_Y };
}

// ── Edge path between two nodes ───────────────────────────────────────────
function edgePath(from, to, positions) {
  const p1 = positions[from];
  const p2 = positions[to];
  if (!p1 || !p2) return null;
  const x1 = p1.x + NODE_W / 2;
  const y1 = p1.y + NODE_H;
  const x2 = p2.x + NODE_W / 2;
  const y2 = p2.y;
  // Same row: straight; different rows: curved
  if (p1.y === p2.y) {
    return `M ${x1} ${y1 - NODE_H} H ${x2}`;
  }
  const cx1 = x1;
  const cy1 = y1 + (y2 - y1) * 0.4;
  const cx2 = x2;
  const cy2 = y2 - (y2 - y1) * 0.4;
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

// ── Tooltip component ──────────────────────────────────────────────────────
function Tooltip({ step, metrics, x, y, workflowSteps }) {
  const m = metrics[step];
  const wStep = workflowSteps?.find(s => s.step_id === step);
  const title = wStep?.step_title || step;
  const qtype = wStep?.question_type || "—";

  const outcomeList = Array.from(m?.outcomes || []);

  return (
    <foreignObject x={x} y={y} width={220} height={160} style={{ pointerEvents: "none", overflow: "visible" }}>
      <div xmlns="http://www.w3.org/1999/xhtml"
        className="bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 w-52 space-y-1.5"
        style={{ pointerEvents: "none" }}
      >
        <p className="font-semibold text-white leading-snug">{title}</p>
        <p className="text-slate-400 font-mono text-[10px]">{step}</p>
        <div className="border-t border-slate-700 pt-1.5 space-y-0.5">
          <p><span className="text-slate-400">Type:</span> <span className="capitalize">{qtype.replace(/_/g, " ")}</span></p>
          <p><span className="text-slate-400">Appears in:</span> {m?.pathCount} path{m?.pathCount !== 1 ? "s" : ""}</p>
          <p><span className="text-slate-400">Outcomes:</span> {outcomeList.map(o => STATUS[o]?.label || o).join(", ")}</p>
          <p><span className="text-slate-400">Leads to:</span> {m?.outgoingTo?.size || 0} next step{m?.outgoingTo?.size !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </foreignObject>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────
const LEGEND = [
  { status: "cycle_detected", icon: RotateCcw, label: "Cycle Detected" },
  { status: "missing_step",   icon: XCircle,   label: "Missing Step Ref" },
  { status: "terminal",       icon: AlertTriangle, label: "Terminal (no result)" },
  { status: "reportable",     icon: CheckCircle2,  label: "Reportable" },
  { status: "non_reportable", icon: CheckCircle2,  label: "Non-Reportable" },
  { status: "healthy",        icon: Info,          label: "Healthy / Intermediate" },
];

// ── Stats bar ──────────────────────────────────────────────────────────────
function StatsBar({ pathsSummary, metrics }) {
  const counts = {};
  pathsSummary.forEach(p => { counts[p.final_status] = (counts[p.final_status] || 0) + 1; });

  const cycleSteps = Object.entries(metrics).filter(([, m]) => m.outcomes.has("cycle_detected")).length;
  const missingSteps = Object.entries(metrics).filter(([, m]) => m.outcomes.has("missing_step")).length;
  const terminalSteps = Object.entries(metrics).filter(([, m]) => m.outcomes.has("terminal") && !m.outcomes.has("cycle_detected") && !m.outcomes.has("missing_step")).length;
  const cleanSteps = Object.keys(metrics).length - cycleSteps - missingSteps - terminalSteps;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {[
        { label: "Steps in Cycles", value: cycleSteps, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
        { label: "Missing Refs", value: missingSteps, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
        { label: "Terminal-only Steps", value: terminalSteps, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
        { label: "Clean Steps", value: cleanSteps, color: "text-green-600", bg: "bg-green-50 border-green-200" },
      ].map(s => (
        <div key={s.label} className={`rounded-lg border p-3 ${s.bg}`}>
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WorkflowHealthMap({ pathsSummary, workflowName, workflowSteps }) {
  const [hoveredStep, setHoveredStep] = useState(null);
  const [filter, setFilter] = useState("all"); // all | cycle_detected | missing_step | terminal

  const metrics = useMemo(() => computeStepMetrics(pathsSummary), [pathsSummary]);
  const orderedSteps = useMemo(() => buildOrderedSteps(pathsSummary, workflowSteps), [pathsSummary, workflowSteps]);
  const edges = useMemo(() => buildEdges(pathsSummary), [pathsSummary]);

  // Filter steps based on selected filter
  const filteredSteps = useMemo(() => {
    if (filter === "all") return orderedSteps;
    return orderedSteps.filter(sid => metrics[sid]?.outcomes.has(filter));
  }, [orderedSteps, metrics, filter]);

  const { positions, width, height } = useMemo(() => layout(filteredSteps), [filteredSteps]);

  // Only show edges between visible steps
  const visibleEdges = useMemo(() =>
    edges.filter(e => positions[e.from] && positions[e.to]),
    [edges, positions]
  );

  const svgWidth = width + 40;
  const svgHeight = height + 40;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Workflow Health Map
            <Badge variant="outline" className="font-normal text-xs ml-1">{orderedSteps.length} steps · {pathsSummary.length} paths</Badge>
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: "all", label: "All" },
              { key: "cycle_detected", label: "Cycles" },
              { key: "missing_step", label: "Missing" },
              { key: "terminal", label: "Terminal" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  filter === f.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {f.label}
                {f.key !== "all" && (
                  <span className="ml-1 opacity-70">
                    ({orderedSteps.filter(s => metrics[s]?.outcomes.has(f.key)).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <StatsBar pathsSummary={pathsSummary} metrics={metrics} />

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b border-slate-100">
          {LEGEND.map(l => {
            const s = STATUS[l.status];
            return (
              <div key={l.status} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: s.fill, borderColor: s.stroke }} />
                <span className="text-xs text-slate-600">{l.label}</span>
              </div>
            );
          })}
        </div>

        {/* SVG Map */}
        <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2" style={{ maxHeight: 560 }}>
          {filteredSteps.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No steps match this filter.</div>
          ) : (
            <svg
              width={svgWidth}
              height={svgHeight}
              style={{ display: "block", minWidth: svgWidth }}
            >
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-cycle" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="#ea580c" />
                </marker>
                <marker id="arrow-missing" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" />
                </marker>
              </defs>

              <g transform="translate(20,20)">
                {/* Edges */}
                {visibleEdges.map((edge, i) => {
                  const path = edgePath(edge.from, edge.to, positions);
                  if (!path) return null;
                  const hasCycle = edge.outcomes.has("cycle_detected");
                  const hasMissing = edge.outcomes.has("missing_step");
                  const color = hasCycle ? "#ea580c" : hasMissing ? "#7c3aed" : "#cbd5e1";
                  const markerId = hasCycle ? "arrow-cycle" : hasMissing ? "arrow-missing" : "arrow";
                  return (
                    <path
                      key={i}
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={hasCycle || hasMissing ? 2 : 1.5}
                      strokeDasharray={hasCycle ? "5,3" : hasMissing ? "3,2" : "none"}
                      markerEnd={`url(#${markerId})`}
                      opacity={0.7}
                    />
                  );
                })}

                {/* Nodes */}
                {filteredSteps.map(sid => {
                  const pos = positions[sid];
                  if (!pos) return null;
                  const m = metrics[sid];
                  const worst = worstStatus(m?.outcomes || new Set());
                  const s = STATUS[worst] || STATUS.healthy;
                  const wStep = workflowSteps?.find(ws => ws.step_id === sid);
                  const label = wStep?.step_title || sid;
                  const qtype = wStep?.question_type || "";
                  const isHovered = hoveredStep === sid;

                  return (
                    <g key={sid}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredStep(sid)}
                      onMouseLeave={() => setHoveredStep(null)}
                    >
                      {/* Drop shadow on hover */}
                      {isHovered && (
                        <rect x={-2} y={-2} width={NODE_W + 4} height={NODE_H + 4}
                          rx={10} fill="none" stroke={s.stroke} strokeWidth={2.5} opacity={0.4} />
                      )}
                      {/* Node box */}
                      <rect x={0} y={0} width={NODE_W} height={NODE_H}
                        rx={8} fill={s.fill} stroke={s.stroke} strokeWidth={isHovered ? 2 : 1.5} />

                      {/* Status stripe on left */}
                      <rect x={0} y={0} width={5} height={NODE_H} rx={8} fill={s.stroke} />
                      <rect x={0} y={4} width={5} height={NODE_H - 8} fill={s.stroke} />

                      {/* Title text */}
                      <foreignObject x={10} y={6} width={NODE_W - 14} height={NODE_H - 8}>
                        <div xmlns="http://www.w3.org/1999/xhtml"
                          style={{ fontSize: 10, fontWeight: 600, color: s.text, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {label}
                        </div>
                      </foreignObject>

                      {/* Badge: path count */}
                      <rect x={NODE_W - 28} y={NODE_H - 18} width={26} height={14} rx={7} fill={s.stroke} opacity={0.9} />
                      <text x={NODE_W - 15} y={NODE_H - 8} textAnchor="middle"
                        fontSize={8} fill="white" fontWeight="bold">
                        {m?.pathCount || 0}
                      </text>
                    </g>
                  );
                })}

                {/* Tooltip layer (rendered on top) */}
                {hoveredStep && positions[hoveredStep] && (() => {
                  const pos = positions[hoveredStep];
                  // Position tooltip right of node, or flip left if near edge
                  const ttx = pos.x + NODE_W + 8;
                  const tty = pos.y - 10;
                  return (
                    <Tooltip
                      step={hoveredStep}
                      metrics={metrics}
                      x={ttx}
                      y={tty}
                      workflowSteps={workflowSteps}
                    />
                  );
                })()}
              </g>
            </svg>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-2 text-center">
          Hover over a node to see details · Numbers on nodes = path count · Dashed orange edges = cycle paths · Dashed purple = missing step refs
        </p>
      </CardContent>
    </Card>
  );
}