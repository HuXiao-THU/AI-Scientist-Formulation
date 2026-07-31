"""Synthetic-but-realistic urban corridor traffic speed dataset.

Generates a deterministic multi-week time series of 5-minute average speeds
(km/h) for one arterial corridor, reproducing the canonical patterns found in
loop-detector datasets such as METR-LA / PeMS:

- free-flow speed plateau at night,
- weekday morning / evening rush-hour dips,
- lighter and later weekend peaks,
- weather / incident disturbances (random localized speed drops),
- measurement noise.

The dataset is deterministic for a given seed so experiments are reproducible.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np

SAMPLES_PER_DAY = 288  # 5-minute intervals
DEFAULT_WEEKS = 4
FREE_FLOW_SPEED = 65.0


@dataclass(frozen=True)
class TrafficDataset:
    """Immutable container for the generated series and calendar features."""

    speed: np.ndarray  # shape (T,), km/h
    minute_of_day: np.ndarray  # shape (T,), int 0..1435
    day_of_week: np.ndarray  # shape (T,), int 0..6 (0 = Monday)

    @property
    def size(self) -> int:
        return int(self.speed.shape[0])


def _daily_profile(minute_of_day: np.ndarray, is_weekend: np.ndarray) -> np.ndarray:
    """Speed reduction profile (km/h below free flow) for each timestamp."""
    hour = minute_of_day / 60.0

    def bump(center: float, width: float, magnitude: float) -> np.ndarray:
        return magnitude * np.exp(-0.5 * ((hour - center) / width) ** 2)

    weekday_drop = bump(8.0, 1.1, 30.0) + bump(18.0, 1.4, 34.0) + bump(12.5, 1.8, 8.0)
    weekend_drop = bump(11.5, 2.2, 14.0) + bump(16.5, 2.5, 16.0)
    return np.where(is_weekend, weekend_drop, weekday_drop)


@lru_cache(maxsize=4)
def generate_dataset(seed: int = 42, weeks: int = DEFAULT_WEEKS) -> TrafficDataset:
    rng = np.random.default_rng(seed)
    total = weeks * 7 * SAMPLES_PER_DAY

    idx = np.arange(total)
    minute_of_day = (idx % SAMPLES_PER_DAY) * 5
    day_of_week = (idx // SAMPLES_PER_DAY) % 7
    is_weekend = day_of_week >= 5

    speed = np.full(total, FREE_FLOW_SPEED, dtype=float)

    # Day-to-day demand variability: each day's congestion profile is scaled
    # by a random factor, so a pure time-of-day climatology cannot explain
    # everything and recent observations carry real predictive signal.
    day_index = idx // SAMPLES_PER_DAY
    day_scale = rng.uniform(0.55, 1.45, weeks * 7)[day_index]
    speed -= _daily_profile(minute_of_day, is_weekend) * day_scale

    # Slow weekly demand drift (e.g. seasonal traffic volume changes).
    speed += 1.5 * np.sin(2.0 * np.pi * idx / (7 * SAMPLES_PER_DAY))

    # Incidents: localized capacity drops lasting 30-120 minutes.
    n_incidents = weeks * 5
    for _ in range(n_incidents):
        start = int(rng.integers(0, total - 30))
        duration = int(rng.integers(6, 24))  # 30 min .. 2 h
        magnitude = float(rng.uniform(8.0, 22.0))
        window = np.arange(duration)
        profile = magnitude * np.sin(np.pi * (window + 0.5) / duration)
        end = min(start + duration, total)
        speed[start:end] -= profile[: end - start]

    # Strongly autocorrelated demand/measurement noise: recent observations
    # remain informative over a 30-minute horizon.
    noise = np.empty(total)
    noise[0] = rng.normal(0.0, 1.0)
    innovations = rng.normal(0.0, 1.0, total)
    for t in range(1, total):
        noise[t] = 0.9 * noise[t - 1] + innovations[t]
    speed += noise

    np.clip(speed, 3.0, FREE_FLOW_SPEED + 5.0, out=speed)

    return TrafficDataset(
        speed=speed,
        minute_of_day=minute_of_day.astype(int),
        day_of_week=day_of_week.astype(int),
    )
