"""Real experiment execution for the traffic speed prediction problem.

Each experiment trains an actual scikit-learn model on the corridor dataset
and reports true out-of-sample MAE / RMSE. Experiments are cheap (< 1 s) so
that the research agent can explore dozens of configurations interactively.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.neural_network import MLPRegressor

from .dataset import SAMPLES_PER_DAY, TrafficDataset, generate_dataset

MODEL_NAMES = ("historical_average", "ridge", "gradient_boosting", "random_forest", "mlp")
TEST_FRACTION = 0.25


@dataclass(frozen=True)
class ExperimentConfig:
    """A single point in the experiment design space."""

    model: str = "historical_average"
    n_lags: int = 0  # autoregressive lag features (5-min steps)
    horizon: int = 6  # predict 30 minutes ahead
    use_time_features: bool = False  # minute-of-day / day-of-week encodings
    use_rolling: bool = False  # rolling mean features (30 min / 2 h)
    hyperparams: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "n_lags": self.n_lags,
            "horizon": self.horizon,
            "use_time_features": self.use_time_features,
            "use_rolling": self.use_rolling,
            "hyperparams": dict(self.hyperparams),
        }

    def describe(self) -> str:
        parts = [self.model]
        if self.n_lags:
            parts.append(f"{self.n_lags} lags")
        if self.use_time_features:
            parts.append("time-of-day/dow features")
        if self.use_rolling:
            parts.append("rolling means")
        if self.hyperparams:
            parts.append(", ".join(f"{k}={v}" for k, v in sorted(self.hyperparams.items())))
        return " + ".join(parts)


@dataclass(frozen=True)
class ExperimentResult:
    mae: float
    rmse: float
    n_train: int
    n_test: int
    duration_s: float


def _build_features(data: TrafficDataset, config: ExperimentConfig) -> tuple[np.ndarray, np.ndarray]:
    """Return (X, y) aligned so X[t] predicts speed[t + horizon]."""
    speed = data.speed
    total = data.size
    max_lag = max(config.n_lags, 24 if config.use_rolling else 0)
    start = max_lag
    end = total - config.horizon
    rows = np.arange(start, end)

    columns: list[np.ndarray] = [speed[rows]]
    for lag in range(1, config.n_lags + 1):
        columns.append(speed[rows - lag])
    if config.use_time_features:
        minute = data.minute_of_day[rows + config.horizon]
        dow = data.day_of_week[rows + config.horizon]
        angle = 2.0 * np.pi * minute / 1440.0
        columns.extend([np.sin(angle), np.cos(angle), (dow >= 5).astype(float)])
    if config.use_rolling:
        cumsum = np.concatenate(([0.0], np.cumsum(speed)))

        def rolling_mean(width: int) -> np.ndarray:
            return (cumsum[rows + 1] - cumsum[rows + 1 - width]) / width

        columns.extend([rolling_mean(6), rolling_mean(24)])

    X = np.column_stack(columns)
    y = speed[rows + config.horizon]
    return X, y


def _historical_average_predict(
    data: TrafficDataset, config: ExperimentConfig, split: int, test_rows: np.ndarray
) -> np.ndarray:
    """Baseline: average speed per (minute-of-day, weekend flag) over train period."""
    target_rows = test_rows + config.horizon
    train_minute = data.minute_of_day[:split]
    train_weekend = (data.day_of_week[:split] >= 5).astype(int)
    train_speed = data.speed[:split]

    table = np.zeros((2, SAMPLES_PER_DAY))
    for weekend in (0, 1):
        for slot in range(SAMPLES_PER_DAY):
            mask = (train_weekend == weekend) & (train_minute == slot * 5)
            table[weekend, slot] = train_speed[mask].mean() if mask.any() else train_speed.mean()

    slot_idx = data.minute_of_day[target_rows] // 5
    weekend_idx = (data.day_of_week[target_rows] >= 5).astype(int)
    return table[weekend_idx, slot_idx]


def _make_model(config: ExperimentConfig, seed: int) -> Any:
    hp = config.hyperparams
    if config.model == "ridge":
        return Ridge(alpha=float(hp.get("alpha", 1.0)))
    if config.model == "gradient_boosting":
        return GradientBoostingRegressor(
            n_estimators=int(hp.get("n_estimators", 60)),
            max_depth=int(hp.get("max_depth", 3)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            subsample=0.7,
            random_state=seed,
        )
    if config.model == "random_forest":
        return RandomForestRegressor(
            n_estimators=int(hp.get("n_estimators", 40)),
            max_depth=int(hp.get("max_depth", 10)),
            n_jobs=-1,
            random_state=seed,
        )
    if config.model == "mlp":
        return MLPRegressor(
            hidden_layer_sizes=tuple(hp.get("hidden_layer_sizes", (32, 16))),
            max_iter=int(hp.get("max_iter", 120)),
            early_stopping=True,
            random_state=seed,
        )
    raise ValueError(f"unknown model: {config.model}")


def run_experiment(config: ExperimentConfig, seed: int = 42) -> ExperimentResult:
    """Train the configured model and return real out-of-sample metrics."""
    started = time.perf_counter()
    data = generate_dataset(seed=seed)
    split = int(data.size * (1.0 - TEST_FRACTION))

    if config.model == "historical_average":
        max_lag = max(config.n_lags, 24 if config.use_rolling else 0)
        rows = np.arange(max_lag, data.size - config.horizon)
        test_rows = rows[rows >= split]
        y_true = data.speed[test_rows + config.horizon]
        y_pred = _historical_average_predict(data, config, split, test_rows)
        n_train = split
    else:
        X, y = _build_features(data, config)
        max_lag = max(config.n_lags, 24 if config.use_rolling else 0)
        boundary = split - max_lag
        X_train, y_train = X[:boundary], y[:boundary]
        X_test, y_true = X[boundary:], y[boundary:]
        model = _make_model(config, seed)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        n_train = int(len(y_train))

    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    return ExperimentResult(
        mae=round(mae, 4),
        rmse=round(rmse, 4),
        n_train=n_train,
        n_test=int(len(y_true)),
        duration_s=round(time.perf_counter() - started, 3),
    )
