"""Auto-generated markdown research report for a completed (or ongoing) run.

Turns the experiment tree into a research-log style document: problem
statement, context budget accounting, full experiment table, the best
hypothesis chain and a conclusion.
"""

from __future__ import annotations

from typing import Any

from .agent import short_label
from .ccts import compute_depth_upper_bound

_VERDICT = {True: "improved", False: "no gain"}


def build_report(run: Any) -> str:
    nodes = sorted(run.nodes, key=lambda n: n.step_index)
    executed = [n for n in nodes if n.metric_value is not None]
    best = min(executed, key=lambda n: n.metric_value) if executed else None
    d_star = compute_depth_upper_bound(
        total_context=run.context_window,
        static_overhead=run.static_cost,
        task_demand=run.task_cost,
        mean_information_gain=run.delta_i,
        alpha=run.alpha,
    )
    steps_used = max((n.step_index for n in nodes), default=0)

    lines: list[str] = []
    lines.append("# Autonomous Research Report: 30-min Traffic Speed Prediction")
    lines.append("")
    lines.append(f"*Run `{run.id[:8]}` — status: **{run.status}** — generated automatically by the CCTS research agent.*")
    lines.append("")
    lines.append("## 1. Problem")
    lines.append("")
    lines.append(
        "Predict corridor average speed 30 minutes ahead from 5-minute loop-detector "
        "history (4 weeks of data, last 25% held out chronologically). "
        f"Success criterion: test MAE <= {run.target_mae:.2f} km/h."
    )
    lines.append("")
    lines.append("## 2. Context Budget (CCTS)")
    lines.append("")
    lines.append("| Quantity | Value |")
    lines.append("| --- | --- |")
    lines.append(f"| Context window C | {run.context_window:,} tokens |")
    lines.append(f"| Static overhead S | {run.static_cost:,} tokens |")
    lines.append(f"| Task demand D | {run.task_cost:,} tokens |")
    lines.append(f"| Mean information gain dI | {run.delta_i} tokens/experiment |")
    lines.append(f"| Compression ratio alpha | {run.alpha:g} |")
    lines.append(f"| Depth upper bound d* | **{d_star}** experiments |")
    lines.append(f"| Experiments executed | {steps_used} |")
    lines.append(f"| History context c_hist | {run.latest_c_hist:,.0f} tokens |")
    lines.append(f"| Remaining work context c_work | {run.latest_c_work:,.0f} tokens |")
    lines.append("")
    lines.append("## 3. Experiment Log")
    lines.append("")
    lines.append("| # | Action | Configuration | MAE (km/h) | vs parent | Verdict |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    by_id = {n.id: n for n in nodes}
    for node in executed:
        parent = by_id.get(node.parent_id) if node.parent_id else None
        if parent is not None and parent.metric_value is not None:
            delta = node.metric_value - parent.metric_value
            delta_text = f"{delta:+.3f}"
            verdict = _VERDICT[delta < 0]
        else:
            delta_text = "—"
            verdict = "baseline"
        marker = " ⭐" if best is not None and node.id == best.id else ""
        lines.append(
            f"| {node.step_index} | {node.action or 'baseline'} | "
            f"{short_label(node.config)} | {node.metric_value:.3f}{marker} | {delta_text} | {verdict} |"
        )
    lines.append("")

    if best is not None:
        lines.append("## 4. Best Hypothesis Chain")
        lines.append("")
        chain: list[Any] = []
        cursor: Any | None = best
        while cursor is not None:
            chain.append(cursor)
            cursor = by_id.get(cursor.parent_id) if cursor.parent_id else None
        for node in reversed(chain):
            if node.hypothesis:
                lines.append(f"- **#{node.step_index} {node.action}** — {node.hypothesis}")
            else:
                lines.append(f"- **#{node.step_index} baseline** — establish the climatology reference point.")
            if node.metric_value is not None:
                lines[-1] += f" *(MAE {node.metric_value:.3f})*"
        lines.append("")
        lines.append("## 5. Conclusion")
        lines.append("")
        baseline = executed[0].metric_value if executed else None
        gain = (1.0 - best.metric_value / baseline) * 100.0 if baseline else 0.0
        lines.append(
            f"Best configuration: **{short_label(best.config)}** with test MAE "
            f"**{best.metric_value:.3f} km/h**, a **{gain:.1f}%** improvement over the "
            f"baseline ({baseline:.3f} km/h)."
        )
        if run.status == "completed":
            lines.append(
                f"The success criterion (MAE <= {run.target_mae:.2f}) was met after "
                f"{steps_used} experiments, within the context budget of d* = {d_star}."
            )
        elif run.status == "failed":
            lines.append(
                f"The context budget was exhausted after {steps_used} experiments "
                f"(d* = {d_star}) before reaching the success criterion — the problem "
                "is infeasible at this context window under CCTS."
            )
        else:
            lines.append("The run is still in progress.")
    lines.append("")
    return "\n".join(lines)
