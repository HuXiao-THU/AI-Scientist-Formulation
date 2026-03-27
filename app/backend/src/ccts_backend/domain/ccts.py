from __future__ import annotations

from dataclasses import dataclass
from math import floor


@dataclass(frozen=True)
class CCTSParameters:
    total_context: int
    static_overhead: int
    task_demand: int
    mean_information_gain: int
    alpha: float


def compute_depth_upper_bound(
    total_context: int,
    static_overhead: int,
    task_demand: int,
    mean_information_gain: int,
    alpha: float,
) -> int:
    """d* = floor((C - S - D) / (alpha * delta_I))."""
    numerator = total_context - static_overhead - task_demand
    denominator = alpha * mean_information_gain
    if numerator <= 0 or denominator <= 0:
        return 0
    return max(0, floor(numerator / denominator))


def compute_history_context(depth: int, mean_information_gain: int, alpha: float) -> float:
    """c_hist(depth) = depth * delta_I * alpha."""
    return float(depth * mean_information_gain * alpha)


def compute_work_context(total_context: int, static_overhead: int, history_context: float) -> float:
    """c_work = C - S - c_hist."""
    return float(total_context - static_overhead - history_context)


def is_feasible(
    total_context: int,
    static_overhead: int,
    history_context: float,
    task_demand: int,
) -> bool:
    """Feasibility condition: c_work >= D."""
    return compute_work_context(total_context, static_overhead, history_context) >= task_demand


def compute_context_budget(
    total_context: int,
    static_overhead: int,
    mean_information_gain: int,
    alpha: float,
    depth: int,
) -> tuple[float, float]:
    """Return (c_hist, c_work) for a target depth."""
    c_hist = compute_history_context(depth, mean_information_gain, alpha)
    c_work = compute_work_context(total_context, static_overhead, c_hist)
    return c_hist, c_work
