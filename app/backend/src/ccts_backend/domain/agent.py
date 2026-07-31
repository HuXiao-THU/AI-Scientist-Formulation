"""Research-agent policy: tree search over the experiment design space.

The policy mimics how a human researcher iterates: pick a promising branch,
form a hypothesis, mutate one aspect of the configuration, run the experiment
and judge the result. Every proposal carries a natural-language hypothesis so
the UI and the auto-generated report read like a research log.

The proposal step is intentionally isolated behind ``propose_next`` so a real
LLM planner can replace the heuristic without touching the execution loop.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any, Protocol

from .experiments import ExperimentConfig

LAG_LADDER = (3, 6, 12, 24)


class TreeNodeView(Protocol):
    """Minimal view of an executed experiment node."""

    id: str
    status: str
    metric_value: float | None
    config: dict[str, Any] | None


@dataclass(frozen=True)
class Proposal:
    parent_id: str
    config: ExperimentConfig
    action: str
    hypothesis: str


def _config_from_dict(raw: dict[str, Any]) -> ExperimentConfig:
    return ExperimentConfig(
        model=raw.get("model", "historical_average"),
        n_lags=int(raw.get("n_lags", 0)),
        horizon=int(raw.get("horizon", 6)),
        use_time_features=bool(raw.get("use_time_features", False)),
        use_rolling=bool(raw.get("use_rolling", False)),
        hyperparams=dict(raw.get("hyperparams", {})),
    )


def _mutations(config: ExperimentConfig) -> list[tuple[ExperimentConfig, str, str]]:
    """Candidate (config, action, hypothesis) moves from a parent config."""
    moves: list[tuple[ExperimentConfig, str, str]] = []

    def replace(**kwargs: Any) -> ExperimentConfig:
        base = config.to_dict()
        base.update(kwargs)
        return _config_from_dict(base)

    if config.model == "historical_average":
        moves.append(
            (
                replace(model="ridge", n_lags=LAG_LADDER[0]),
                "switch to autoregressive ridge",
                "The climatology baseline ignores current conditions. Speeds are "
                "strongly autocorrelated, so a ridge regression over recent "
                "observations should cut the error.",
            )
        )
        return moves

    lag_idx = LAG_LADDER.index(config.n_lags) if config.n_lags in LAG_LADDER else -1
    if 0 <= lag_idx < len(LAG_LADDER) - 1:
        nxt = LAG_LADDER[lag_idx + 1]
        moves.append(
            (
                replace(n_lags=nxt),
                f"extend lags {config.n_lags} -> {nxt}",
                f"A {config.n_lags * 5}-minute window may miss congestion buildup; "
                f"extend the lag window to {nxt * 5} minutes.",
            )
        )

    if not config.use_time_features:
        moves.append(
            (
                replace(use_time_features=True),
                "add calendar features",
                "Congestion is periodic. Minute-of-day and weekend encodings let the "
                "model separate recurrent patterns from residual dynamics.",
            )
        )

    if not config.use_rolling:
        moves.append(
            (
                replace(use_rolling=True),
                "add rolling means",
                "Rolling 30-minute and 2-hour means smooth sensor noise and encode "
                "the congestion trend explicitly.",
            )
        )

    if config.model == "ridge":
        if config.use_time_features:
            moves.append(
                (
                    replace(model="gradient_boosting", hyperparams={}),
                    "upgrade to gradient boosting",
                    "Rush-hour dynamics are nonlinear; gradient boosting can model "
                    "interactions between lagged speeds and calendar features.",
                )
            )
            moves.append(
                (
                    replace(model="random_forest", hyperparams={}),
                    "try random forest",
                    "Bagged trees trade bias for variance reduction; test as an "
                    "alternative nonlinear learner.",
                )
            )
            moves.append(
                (
                    replace(model="mlp", hyperparams={}),
                    "try small neural network",
                    "A compact MLP may capture smooth nonlinearities that linear "
                    "models miss.",
                )
            )
        alpha = float(config.hyperparams.get("alpha", 1.0))
        moves.append(
            (
                replace(hyperparams={**config.hyperparams, "alpha": alpha * 10.0}),
                f"tune ridge alpha -> {alpha * 10.0:g}",
                "Stronger L2 regularization may improve generalization on the noisy "
                "test window.",
            )
        )

    if config.model == "gradient_boosting":
        n_est = int(config.hyperparams.get("n_estimators", 60))
        if n_est < 150:
            moves.append(
                (
                    replace(hyperparams={**config.hyperparams, "n_estimators": n_est * 2}),
                    f"more boosting rounds {n_est} -> {n_est * 2}",
                    "The ensemble may be under-fit; double the number of boosting "
                    "rounds for a finer fit.",
                )
            )
        depth = int(config.hyperparams.get("max_depth", 3))
        if depth < 5:
            moves.append(
                (
                    replace(hyperparams={**config.hyperparams, "max_depth": depth + 1}),
                    f"deepen trees {depth} -> {depth + 1}",
                    "Deeper trees can capture higher-order feature interactions "
                    "around rush-hour transitions.",
                )
            )

    if config.model == "random_forest":
        n_est = int(config.hyperparams.get("n_estimators", 40))
        if n_est < 150:
            moves.append(
                (
                    replace(hyperparams={**config.hyperparams, "n_estimators": n_est * 2}),
                    f"grow forest {n_est} -> {n_est * 2}",
                    "More trees reduce ensemble variance at modest compute cost.",
                )
            )

    if config.model == "mlp":
        moves.append(
            (
                replace(hyperparams={**config.hyperparams, "hidden_layer_sizes": (64, 32)}),
                "widen network",
                "A wider hidden layer increases capacity for the nonlinear speed "
                "profile.",
            )
        )

    return moves


def propose_next(nodes: list[TreeNodeView], rng: random.Random) -> Proposal | None:
    """Pick a parent node and an untried mutation; None if space is exhausted."""
    tried = {
        _config_key(node.config)
        for node in nodes
        if node.config is not None
    }
    candidates = [
        node
        for node in nodes
        if node.config is not None and node.metric_value is not None and node.status != "error"
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda node: node.metric_value)

    # Mostly exploit the best branch, occasionally explore the runner-up.
    order = list(candidates)
    if len(order) > 1 and rng.random() < 0.25:
        order[0], order[1] = order[1], order[0]

    for parent in order:
        config = _config_from_dict(parent.config)  # type: ignore[arg-type]
        moves = [m for m in _mutations(config) if _config_key(m[0].to_dict()) not in tried]
        if moves:
            new_config, action, hypothesis = rng.choice(moves)
            return Proposal(
                parent_id=parent.id,
                config=new_config,
                action=action,
                hypothesis=hypothesis,
            )
    return None


def _config_key(raw: dict[str, Any] | None) -> str:
    if raw is None:
        return "<none>"
    hyper = ",".join(f"{k}={v}" for k, v in sorted(raw.get("hyperparams", {}).items()))
    return (
        f"{raw.get('model')}|{raw.get('n_lags')}|{raw.get('horizon')}|"
        f"{raw.get('use_time_features')}|{raw.get('use_rolling')}|{hyper}"
    )


def short_label(raw: dict[str, Any] | None) -> str:
    """Compact node label for tree visualization, e.g. 'GBM 12L+T+R'."""
    if raw is None:
        return "root"
    abbrev = {
        "historical_average": "HA",
        "ridge": "Ridge",
        "gradient_boosting": "GBM",
        "random_forest": "RF",
        "mlp": "MLP",
    }.get(str(raw.get("model")), str(raw.get("model")))
    parts = [abbrev]
    if raw.get("n_lags"):
        parts.append(f"{raw['n_lags']}L")
    flags = ""
    if raw.get("use_time_features"):
        flags += "+T"
    if raw.get("use_rolling"):
        flags += "+R"
    if flags:
        parts.append(flags)
    return " ".join(parts)
