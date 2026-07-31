"""Tests for the CCTS Research Navigator skill scripts.

Run from the skill root:  python -m pytest tests/ -q
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = SKILL_ROOT / "scripts"


def run_script(name: str, *args: str) -> dict:
    completed = subprocess.run(
        [sys.executable, str(SCRIPTS / name), *args],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(completed.stdout)


def test_budget_feasible() -> None:
    result = run_script(
        "context_budget.py",
        "--context-window", "32000",
        "--static-cost", "3500",
        "--task-cost", "8600",
        "--delta-i", "50",
        "--alpha", "10",
        "--steps", "5",
    )
    assert result["d_star"] == 39
    assert result["feasible"] is True
    assert len(result["schedule"]) == 5
    assert result["schedule"][0] == {"step": 1, "c_hist": 500.0, "c_work": 28000.0, "feasible": True}


def test_budget_infeasible() -> None:
    result = run_script("context_budget.py", "--context-window", "12500")
    assert result["d_star"] == 0
    assert result["feasible"] is False


def test_run_experiment_baseline_and_model() -> None:
    baseline = run_script("run_experiment.py", "--model", "historical_average")
    ridge = run_script("run_experiment.py", "--model", "ridge", "--n-lags", "6")
    assert 2.0 < baseline["mae"] < 8.0
    assert ridge["mae"] < baseline["mae"]  # autoregression beats climatology
    assert ridge["n_test"] > 1000


def test_run_experiment_reproducible() -> None:
    a = run_script("run_experiment.py", "--model", "ridge", "--n-lags", "3")
    b = run_script("run_experiment.py", "--model", "ridge", "--n-lags", "3")
    assert a["mae"] == b["mae"]
    assert a["rmse"] == b["rmse"]


def test_make_report(tmp_path: Path) -> None:
    log = tmp_path / "experiments.jsonl"
    entries = [
        {"step": 0, "action": "baseline", "config_desc": "HA", "mae": 4.2, "parent_step": None,
         "hypothesis": "Establish a climatology baseline."},
        {"step": 1, "action": "ridge", "config_desc": "Ridge 3L", "mae": 3.2, "parent_step": 0,
         "hypothesis": "Speeds are autocorrelated."},
        {"step": 2, "action": "gbm", "config_desc": "GBM 12L+T", "mae": 2.4, "parent_step": 1,
         "hypothesis": "Rush-hour dynamics are nonlinear."},
    ]
    log.write_text("\n".join(json.dumps(e) for e in entries), encoding="utf-8")
    output = tmp_path / "report.md"

    result = run_script(
        "make_report.py",
        "--log", str(log),
        "--target-mae", "2.5",
        "--output", str(output),
    )
    assert result["experiments"] == 3
    markdown = output.read_text(encoding="utf-8")
    assert "# Autonomous Research Report" in markdown
    assert "GBM 12L+T" in markdown
    assert "was met" in markdown
    assert "⭐" in markdown
