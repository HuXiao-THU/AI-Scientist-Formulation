#!/usr/bin/env python3
"""Render an experiments JSONL log into a markdown research report.

Each line of the log is a JSON object:
    {"step": 1, "action": "...", "config_desc": "...", "hypothesis": "...",
     "mae": 3.199, "parent_step": 0}

Example:
    python make_report.py --log experiments.jsonl --context-window 32000 \
        --target-mae 2.5 --output report.md
"""

from __future__ import annotations

import argparse
import json
from math import floor
from pathlib import Path

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "research_report.md"


def load_log(path: Path) -> list[dict]:
    entries = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    entries.sort(key=lambda e: e["step"])
    return entries


def build_report(entries: list[dict], args: argparse.Namespace) -> str:
    by_step = {e["step"]: e for e in entries}
    best = min(entries, key=lambda e: e["mae"])
    baseline = entries[0]

    numerator = args.context_window - args.static_cost - args.task_cost
    denominator = args.alpha * args.delta_i
    d_star = max(0, floor(numerator / denominator)) if numerator > 0 and denominator > 0 else 0

    rows = []
    for entry in entries:
        parent = by_step.get(entry.get("parent_step"))
        if parent is not None:
            delta = entry["mae"] - parent["mae"]
            delta_text, verdict = f"{delta:+.3f}", ("improved" if delta < 0 else "no gain")
        else:
            delta_text, verdict = "—", "baseline"
        star = " ⭐" if entry["step"] == best["step"] else ""
        rows.append(
            f"| {entry['step']} | {entry.get('action', 'baseline')} | "
            f"{entry.get('config_desc', '—')} | {entry['mae']:.3f}{star} | {delta_text} | {verdict} |"
        )

    chain = []
    cursor: dict | None = best
    while cursor is not None:
        chain.append(cursor)
        cursor = by_step.get(cursor.get("parent_step"))
    chain_lines = [
        f"- **#{e['step']} {e.get('action', 'baseline')}** — "
        f"{e.get('hypothesis', 'establish the baseline reference point.')} *(MAE {e['mae']:.3f})*"
        for e in reversed(chain)
    ]

    gain = (1.0 - best["mae"] / baseline["mae"]) * 100.0
    target_met = best["mae"] <= args.target_mae
    conclusion = (
        f"Best configuration: **{best.get('config_desc', '—')}** with test MAE "
        f"**{best['mae']:.3f} km/h**, a **{gain:.1f}%** improvement over the baseline "
        f"({baseline['mae']:.3f} km/h). "
        + (
            f"The success criterion (MAE <= {args.target_mae:.2f}) was met after "
            f"{len(entries) - 1} experiments, within the context budget of d* = {d_star}."
            if target_met
            else f"The success criterion (MAE <= {args.target_mae:.2f}) was NOT met "
            f"within the context budget of d* = {d_star}."
        )
    )

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    return template.format(
        target_mae=f"{args.target_mae:.2f}",
        context_window=f"{args.context_window:,}",
        static_cost=f"{args.static_cost:,}",
        task_cost=f"{args.task_cost:,}",
        delta_i=args.delta_i,
        alpha=f"{args.alpha:g}",
        d_star=d_star,
        n_experiments=len(entries) - 1,
        experiment_rows="\n".join(rows),
        hypothesis_chain="\n".join(chain_lines),
        conclusion=conclusion,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", type=Path, required=True, help="experiments JSONL file")
    parser.add_argument("--context-window", type=int, default=32000)
    parser.add_argument("--static-cost", type=int, default=3500)
    parser.add_argument("--task-cost", type=int, default=8600)
    parser.add_argument("--delta-i", type=int, default=50)
    parser.add_argument("--alpha", type=float, default=10.0)
    parser.add_argument("--target-mae", type=float, default=2.5)
    parser.add_argument("--output", type=Path, default=Path("report.md"))
    args = parser.parse_args(argv)

    entries = load_log(args.log)
    if not entries:
        parser.error("empty experiments log")
    report = build_report(entries, args)
    args.output.write_text(report, encoding="utf-8")
    print(json.dumps({"output": str(args.output), "experiments": len(entries)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
