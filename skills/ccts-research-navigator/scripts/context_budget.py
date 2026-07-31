#!/usr/bin/env python3
"""CCTS context-budget calculator (stdlib only).

Computes the research depth upper bound d* = floor((C - S - D) / (alpha * dI))
and a per-step c_hist / c_work schedule, so an agent can decide *before*
running experiments whether a problem is solvable within its context window.

Example:
    python context_budget.py --context-window 32000 --static-cost 3500 \
        --task-cost 8600 --delta-i 50 --alpha 10 --steps 12
"""

from __future__ import annotations

import argparse
import json
import sys
from math import floor


def compute_budget(
    context_window: int,
    static_cost: int,
    task_cost: int,
    delta_i: int,
    alpha: float,
    steps: int,
) -> dict:
    numerator = context_window - static_cost - task_cost
    denominator = alpha * delta_i
    d_star = max(0, floor(numerator / denominator)) if numerator > 0 and denominator > 0 else 0

    schedule = []
    for step in range(1, steps + 1):
        c_hist = step * delta_i * alpha
        c_work = context_window - static_cost - c_hist
        schedule.append(
            {
                "step": step,
                "c_hist": c_hist,
                "c_work": c_work,
                "feasible": c_work >= task_cost,
            }
        )

    return {
        "context_window": context_window,
        "static_cost": static_cost,
        "task_cost": task_cost,
        "delta_i": delta_i,
        "alpha": alpha,
        "d_star": d_star,
        "feasible": d_star >= 1,
        "schedule": schedule,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--context-window", type=int, required=True, help="C: total context tokens")
    parser.add_argument("--static-cost", type=int, default=3500, help="S: static overhead tokens")
    parser.add_argument("--task-cost", type=int, default=8600, help="D: per-experiment task demand")
    parser.add_argument("--delta-i", type=int, default=50, help="dI: mean information gain per experiment")
    parser.add_argument("--alpha", type=float, default=10.0, help="compression ratio")
    parser.add_argument("--steps", type=int, default=10, help="schedule length to print")
    args = parser.parse_args(argv)

    result = compute_budget(
        context_window=args.context_window,
        static_cost=args.static_cost,
        task_cost=args.task_cost,
        delta_i=args.delta_i,
        alpha=args.alpha,
        steps=args.steps,
    )
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
