import React from "react";

const W = 640;
const H = 240;
const M = { top: 18, right: 20, bottom: 38, left: 52 };

export function MaeChart({ nodes, targetMae }) {
  const executed = nodes
    .filter((n) => n.metric_value != null)
    .sort((a, b) => a.step_index - b.step_index);
  if (executed.length === 0) return <p className="hint">No results yet.</p>;

  const xMax = Math.max(executed[executed.length - 1].step_index, 1);
  const values = executed.map((n) => n.metric_value);
  const yMin = Math.min(...values, targetMae) * 0.94;
  const yMax = Math.max(...values) * 1.05;

  const xScale = (step) => M.left + (step / xMax) * (W - M.left - M.right);
  const yScale = (v) => M.top + (1 - (v - yMin) / (yMax - yMin)) * (H - M.top - M.bottom);

  let best = Infinity;
  const bestSeries = executed.map((n) => {
    best = Math.min(best, n.metric_value);
    return { step: n.step_index, value: best };
  });
  const bestPath = bestSeries
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.step)} ${yScale(p.value)}`)
    .join(" ");

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);
  const xTickStep = Math.max(1, Math.ceil(xMax / 10));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="MAE convergence chart">
      {tickValues.map((v) => (
        <g key={v}>
          <line x1={M.left} x2={W - M.right} y1={yScale(v)} y2={yScale(v)} stroke="#1e293b" />
          <text x={M.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize="10.5" fill="#94a3b8">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {Array.from({ length: Math.floor(xMax / xTickStep) + 1 }, (_, i) => i * xTickStep).map((s) => (
        <text key={s} x={xScale(s)} y={H - M.bottom + 16} textAnchor="middle" fontSize="10.5" fill="#94a3b8">
          {s}
        </text>
      ))}
      <line
        x1={M.left}
        x2={W - M.right}
        y1={yScale(targetMae)}
        y2={yScale(targetMae)}
        stroke="#34d399"
        strokeDasharray="6 4"
        strokeWidth="1.5"
      />
      <text x={W - M.right} y={yScale(targetMae) - 6} textAnchor="end" fontSize="10.5" fill="#34d399">
        Target MAE {targetMae.toFixed(2)}
      </text>
      <path d={bestPath} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
      {executed.map((n) => (
        <circle
          key={n.id}
          cx={xScale(n.step_index)}
          cy={yScale(n.metric_value)}
          r="4"
          fill={n.status === "success" ? "#38bdf8" : "#64748b"}
          stroke="#0f172a"
        />
      ))}
      <text x={(W + M.left - M.right) / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fill="#cbd5e1">
        Experiment #
      </text>
      <text
        transform={`translate(14, ${(H + M.top - M.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize="11.5"
        fill="#cbd5e1"
      >
        Test MAE (km/h)
      </text>
    </svg>
  );
}

export function BudgetBar({ run }) {
  if (!run) return null;
  const C = run.context_window;
  const S = run.static_cost;
  const hist = Math.min(run.nodes ? maxHist(run.nodes) : 0, C - S);
  const D = run.task_cost;
  const free = Math.max(C - S - hist - D, 0);
  const segments = [
    { label: `Static S (${fmt(S)})`, value: S, color: "#475569" },
    { label: `History c_hist (${fmt(hist)})`, value: hist, color: "#f59e0b" },
    { label: `Task demand D (${fmt(D)})`, value: Math.min(D, C - S - hist), color: "#38bdf8" },
    { label: `Free (${fmt(free)})`, value: free, color: "#134e4a" },
  ];
  return (
    <div>
      <div className="budget-bar" role="img" aria-label="Context budget usage">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="budget-seg"
            style={{ width: `${(seg.value / C) * 100}%`, background: seg.color }}
            title={seg.label}
          />
        ))}
      </div>
      <div className="budget-legend">
        {segments.map((seg) => (
          <span key={seg.label}>
            <i style={{ background: seg.color }} /> {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function maxHist(nodes) {
  return nodes.reduce((acc, n) => Math.max(acc, n.c_hist ?? 0), 0);
}

function fmt(v) {
  return `${Math.round(v).toLocaleString("en-US")}`;
}
