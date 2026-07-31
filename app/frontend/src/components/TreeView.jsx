import React from "react";

const NODE_R = 17;
const LEVEL_H = 92;
const SLOT_W = 118;
const PAD_X = 60;
const PAD_Y = 44;

function layoutTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map(nodes.map((n) => [n.id, []]));
  let root = null;
  for (const node of nodes) {
    if (node.parent_id && children.has(node.parent_id)) {
      children.get(node.parent_id).push(node);
    } else {
      root = node;
    }
  }
  if (!root) return { positions: new Map(), width: 0, height: 0, byId, children };

  for (const list of children.values()) {
    list.sort((a, b) => a.step_index - b.step_index);
  }

  const positions = new Map();
  let nextLeafX = 0;
  let maxDepth = 0;

  function assign(node, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(node.id);
    if (kids.length === 0) {
      positions.set(node.id, { x: nextLeafX, depth });
      nextLeafX += 1;
      return;
    }
    for (const kid of kids) assign(kid, depth + 1);
    const xs = kids.map((k) => positions.get(k.id).x);
    positions.set(node.id, { x: (Math.min(...xs) + Math.max(...xs)) / 2, depth });
  }
  assign(root, 0);

  const width = Math.max(nextLeafX - 1, 0) * SLOT_W + PAD_X * 2;
  const height = maxDepth * LEVEL_H + PAD_Y * 2 + 30;
  for (const pos of positions.values()) {
    pos.px = pos.x * SLOT_W + PAD_X;
    pos.py = pos.depth * LEVEL_H + PAD_Y;
  }
  return { positions, width, height, byId, children };
}

function bestPathIds(nodes) {
  const executed = nodes.filter((n) => n.metric_value != null);
  if (executed.length === 0) return new Set();
  const best = executed.reduce((a, b) => (a.metric_value <= b.metric_value ? a : b));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ids = new Set();
  let cursor = best;
  while (cursor) {
    ids.add(cursor.id);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : null;
  }
  return ids;
}

function maeColor(value, min, max) {
  if (value == null) return "#64748b";
  const t = max > min ? (value - min) / (max - min) : 0;
  // green (best) -> amber -> red (worst)
  const hue = 145 - t * 120;
  return `hsl(${hue}, 70%, 45%)`;
}

export default function TreeView({ nodes, selectedId, onSelect }) {
  const { positions, width, height } = React.useMemo(() => layoutTree(nodes), [nodes]);
  const bestIds = React.useMemo(() => bestPathIds(nodes), [nodes]);
  const executed = nodes.filter((n) => n.metric_value != null);
  const min = Math.min(...executed.map((n) => n.metric_value));
  const max = Math.max(...executed.map((n) => n.metric_value));
  const bestNode = executed.length
    ? executed.reduce((a, b) => (a.metric_value <= b.metric_value ? a : b))
    : null;

  if (nodes.length === 0) {
    return <p className="hint">No experiments yet.</p>;
  }

  return (
    <div className="tree-scroll">
      <svg width={Math.max(width, 320)} height={height} role="img" aria-label="Research tree">
        {nodes.map((node) => {
          if (!node.parent_id || !positions.has(node.parent_id)) return null;
          const from = positions.get(node.parent_id);
          const to = positions.get(node.id);
          if (!from || !to) return null;
          const onBest = bestIds.has(node.id) && bestIds.has(node.parent_id);
          return (
            <path
              key={`edge-${node.id}`}
              d={`M ${from.px} ${from.py + NODE_R} C ${from.px} ${from.py + LEVEL_H / 2}, ${to.px} ${to.py - LEVEL_H / 2}, ${to.px} ${to.py - NODE_R}`}
              fill="none"
              stroke={onBest ? "#fbbf24" : "#334155"}
              strokeWidth={onBest ? 2.5 : 1.5}
            />
          );
        })}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isBest = bestNode && node.id === bestNode.id;
          const isSelected = node.id === selectedId;
          return (
            <g
              key={node.id}
              transform={`translate(${pos.px}, ${pos.py})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(node.id)}
            >
              {isSelected && <circle r={NODE_R + 6} fill="none" stroke="#38bdf8" strokeWidth="2.5" />}
              {isBest && <circle r={NODE_R + 3.5} fill="none" stroke="#fbbf24" strokeWidth="2" />}
              <circle
                r={NODE_R}
                fill={maeColor(node.metric_value, min, max)}
                stroke={node.status === "error" ? "#f87171" : "#0f172a"}
                strokeWidth="2"
              />
              <text textAnchor="middle" dy="4" fontSize="11" fontWeight="700" fill="#f8fafc">
                {node.step_index}
              </text>
              <text textAnchor="middle" y={NODE_R + 13} fontSize="10.5" fill="#cbd5e1">
                {node.label ?? "?"}
              </text>
              <text textAnchor="middle" y={NODE_R + 25} fontSize="10" fill="#94a3b8">
                {node.metric_value != null ? `MAE ${node.metric_value.toFixed(2)}` : "error"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
