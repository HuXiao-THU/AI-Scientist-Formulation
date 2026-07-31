"""End-to-end tests for real-mode research agent runs."""

from fastapi.testclient import TestClient

from ccts_backend.domain.agent import propose_next, short_label
from ccts_backend.domain.experiments import ExperimentConfig, run_experiment
from ccts_backend.main import app

import random

client = TestClient(app)


def _create_real_run(**overrides) -> dict:
    payload = {
        "problem_type": "prediction",
        "mode": "real",
        "context_window": 32000,
        "alpha": 10.0,
        "target_mae": 2.5,
    }
    payload.update(overrides)
    response = client.post("/api/runs", json=payload)
    assert response.status_code == 201
    return response.json()


def test_real_run_creation_executes_baseline() -> None:
    run = _create_real_run()
    assert run["mode"] == "real"
    assert len(run["nodes"]) == 1
    root = run["nodes"][0]
    assert root["config"]["model"] == "historical_average"
    assert root["metric_value"] is not None
    assert 2.0 < root["metric_value"] < 8.0  # real MAE from real data
    assert run["best_mae"] == root["metric_value"]


def test_agent_step_runs_real_experiment_and_improves() -> None:
    run = _create_real_run()
    run_id = run["id"]

    step = client.post(f"/api/runs/{run_id}/steps/agent")
    assert step.status_code == 200
    body = step.json()
    node = body["node"]
    assert node is not None
    assert node["config"]["model"] == "ridge"  # first move off the baseline
    assert node["hypothesis"]
    assert node["action"]
    assert node["metric_value"] < run["nodes"][0]["metric_value"]
    assert node["status"] == "success"


def test_agent_run_reaches_target_within_budget() -> None:
    run = _create_real_run()
    run_id = run["id"]

    final_status = "running"
    for _ in range(40):
        body = client.post(f"/api/runs/{run_id}/steps/agent").json()
        final_status = body["run_status"]
        if final_status != "running":
            break

    assert final_status == "completed"
    detail = client.get(f"/api/runs/{run_id}").json()
    assert detail["best_mae"] <= detail["target_mae"]
    # Tree structure: every non-root node points at an existing parent.
    ids = {n["id"] for n in detail["nodes"]}
    for node in detail["nodes"]:
        if node["step_index"] > 0:
            assert node["parent_id"] in ids


def test_agent_run_fails_when_budget_too_small() -> None:
    # d* = (12500 - 3500 - 8600) / (10 * 50) < 1 -> no experiment fits.
    run = _create_real_run(context_window=12500)
    run_id = run["id"]
    body = client.post(f"/api/runs/{run_id}/steps/agent").json()
    assert body["run_status"] == "failed"
    assert "budget exhausted" in body["reason"]


def test_report_generation() -> None:
    run = _create_real_run()
    run_id = run["id"]
    for _ in range(3):
        client.post(f"/api/runs/{run_id}/steps/agent")

    report = client.get(f"/api/runs/{run_id}/report")
    assert report.status_code == 200
    markdown = report.json()["markdown"]
    assert "# Autonomous Research Report" in markdown
    assert "Context Budget" in markdown
    assert "Experiment Log" in markdown
    assert "Best Hypothesis Chain" in markdown


def test_propose_next_is_deterministic_and_avoids_duplicates() -> None:
    class Node:
        def __init__(self, id, status, metric_value, config):
            self.id = id
            self.status = status
            self.metric_value = metric_value
            self.config = config

    nodes = [Node("root", "success", 4.2, ExperimentConfig().to_dict())]
    p1 = propose_next(nodes, random.Random("seed:1"))
    p2 = propose_next(nodes, random.Random("seed:1"))
    assert p1 is not None and p2 is not None
    assert p1.config == p2.config
    assert p1.parent_id == "root"

    # After the only baseline move is taken, proposals must differ from it.
    nodes.append(Node("child", "success", 3.2, p1.config.to_dict()))
    p3 = propose_next(nodes, random.Random("seed:2"))
    assert p3 is not None
    assert p3.config.to_dict() != p1.config.to_dict()


def test_experiment_engine_reproducible() -> None:
    config = ExperimentConfig(model="ridge", n_lags=6)
    a = run_experiment(config)
    b = run_experiment(config)
    assert a.mae == b.mae
    assert short_label(config.to_dict()) == "Ridge 6L"
