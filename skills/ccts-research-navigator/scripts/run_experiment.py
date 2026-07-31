#!/usr/bin/env python3
"""Self-contained traffic-speed prediction experiment runner.

Trains a real model on a deterministic synthetic corridor dataset (5-minute
average speeds with rush-hour dips, day-to-day demand variability, incidents
and autocorrelated noise) and reports true out-of-sample MAE / RMSE on the
chronologically last 25% of the series.

Example:
    python run_experiment.py --model gradient_boosting --n-lags 12 \
        --time-features --rolling
"""

from __future__ import annotations

import argparse
import json
import sys
import time

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.neural_network import MLPRegressor

SAMPLES_PER_DAY = 288
WEEKS = 4
FREE_FLOW = 65.0
TEST_FRACTION = 0.25
MODELS = ("historical_average", "ridge", "gradient_boosting", "random_forest", "mlp")


def generate_dataset(seed: int = 42) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    total = WEEKS * 7 * SAMPLES_PER_DAY
    idx = np.arange(total)
    minute = (idx % SAMPLES_PER_DAY) * 5
    dow = (idx // SAMPLES_PER_DAY) % 7
    hour = minute / 60.0

    def bump(center: float, width: float, magnitude: float) -> np.ndarray:
        return magnitude * np.exp(-0.5 * ((hour - center) / width) ** 2)

    weekday_drop = bump(8.0, 1.1, 30.0) + bump(18.0, 1.4, 34.0) + bump(12.5, 1.8, 8.0)
    weekend_drop = bump(11.5, 2.2, 14.0) + bump(16.5, 2.5, 16.0)
    profile = np.where(dow >= 5, weekend_drop, weekday_drop)

    day_scale = rng.uniform(0.55, 1.45, WEEKS * 7)[idx // SAMPLES_PER_DAY]
    speed = FREE_FLOW - profile * day_scale
    speed += 1.5 * np.sin(2.0 * np.pi * idx / (7 * SAMPLES_PER_DAY))

    for _ in range(WEEKS * 5):
        start = int(rng.integers(0, total - 30))
        duration = int(rng.integers(6, 24))
        magnitude = float(rng.uniform(8.0, 22.0))
        window = np.arange(duration)
        drop = magnitude * np.sin(np.pi * (window + 0.5) / duration)
        end = min(start + duration, total)
        speed[start:end] -= drop[: end - start]

    noise = np.empty(total)
    noise[0] = rng.normal(0.0, 1.0)
    innovations = rng.normal(0.0, 1.0, total)
    for t in range(1, total):
        noise[t] = 0.9 * noise[t - 1] + innovations[t]
    speed = np.clip(speed + noise, 3.0, FREE_FLOW + 5.0)
    return speed, minute.astype(int), dow.astype(int)


def build_features(
    speed: np.ndarray,
    minute: np.ndarray,
    dow: np.ndarray,
    n_lags: int,
    horizon: int,
    time_features: bool,
    rolling: bool,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    total = speed.shape[0]
    max_lag = max(n_lags, 24 if rolling else 0)
    rows = np.arange(max_lag, total - horizon)

    columns = [speed[rows]]
    for lag in range(1, n_lags + 1):
        columns.append(speed[rows - lag])
    if time_features:
        target_minute = minute[rows + horizon]
        angle = 2.0 * np.pi * target_minute / 1440.0
        columns.extend([np.sin(angle), np.cos(angle), (dow[rows + horizon] >= 5).astype(float)])
    if rolling:
        cumsum = np.concatenate(([0.0], np.cumsum(speed)))
        for width in (6, 24):
            columns.append((cumsum[rows + 1] - cumsum[rows + 1 - width]) / width)
    return np.column_stack(columns), speed[rows + horizon], rows


def make_model(name: str, hyperparams: dict, seed: int):
    if name == "ridge":
        return Ridge(alpha=float(hyperparams.get("alpha", 1.0)))
    if name == "gradient_boosting":
        return GradientBoostingRegressor(
            n_estimators=int(hyperparams.get("n_estimators", 60)),
            max_depth=int(hyperparams.get("max_depth", 3)),
            learning_rate=float(hyperparams.get("learning_rate", 0.1)),
            subsample=0.7,
            random_state=seed,
        )
    if name == "random_forest":
        return RandomForestRegressor(
            n_estimators=int(hyperparams.get("n_estimators", 40)),
            max_depth=int(hyperparams.get("max_depth", 10)),
            n_jobs=-1,
            random_state=seed,
        )
    if name == "mlp":
        return MLPRegressor(
            hidden_layer_sizes=tuple(hyperparams.get("hidden_layer_sizes", (32, 16))),
            max_iter=int(hyperparams.get("max_iter", 120)),
            early_stopping=True,
            random_state=seed,
        )
    raise ValueError(f"unknown model: {name}")


def run(args: argparse.Namespace) -> dict:
    started = time.perf_counter()
    speed, minute, dow = generate_dataset(seed=args.seed)
    split = int(speed.shape[0] * (1.0 - TEST_FRACTION))
    hyperparams = json.loads(args.hyperparams)

    if args.model == "historical_average":
        max_lag = max(args.n_lags, 24 if args.rolling else 0)
        rows = np.arange(max_lag, speed.shape[0] - args.horizon)
        test_rows = rows[rows >= split]
        target = test_rows + args.horizon
        table = np.zeros((2, SAMPLES_PER_DAY))
        train_weekend = (dow[:split] >= 5).astype(int)
        for weekend in (0, 1):
            for slot in range(SAMPLES_PER_DAY):
                mask = (train_weekend == weekend) & (minute[:split] == slot * 5)
                table[weekend, slot] = speed[:split][mask].mean() if mask.any() else speed[:split].mean()
        y_true = speed[target]
        y_pred = table[(dow[target] >= 5).astype(int), minute[target] // 5]
        n_train = split
    else:
        X, y, rows = build_features(
            speed, minute, dow, args.n_lags, args.horizon, args.time_features, args.rolling
        )
        boundary = int(np.searchsorted(rows, split))
        model = make_model(args.model, hyperparams, args.seed)
        model.fit(X[:boundary], y[:boundary])
        y_true, y_pred = y[boundary:], model.predict(X[boundary:])
        n_train = boundary

    return {
        "config": {
            "model": args.model,
            "n_lags": args.n_lags,
            "horizon": args.horizon,
            "use_time_features": args.time_features,
            "use_rolling": args.rolling,
            "hyperparams": hyperparams,
        },
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "n_train": int(n_train),
        "n_test": int(len(y_true)),
        "duration_s": round(time.perf_counter() - started, 3),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=MODELS, default="historical_average")
    parser.add_argument("--n-lags", type=int, default=0, help="number of 5-min lag features")
    parser.add_argument("--horizon", type=int, default=6, help="prediction horizon in 5-min steps")
    parser.add_argument("--time-features", action="store_true", help="add minute-of-day / weekend features")
    parser.add_argument("--rolling", action="store_true", help="add 30-min / 2-h rolling-mean features")
    parser.add_argument("--hyperparams", default="{}", help='JSON dict, e.g. \'{"n_estimators": 120}\'')
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)

    json.dump(run(args), sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
