from fastapi.testclient import TestClient

from ccts_backend.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_run_creation_and_listing() -> None:
    create_response = client.post(
        "/api/runs",
        json={"problem_type": "prediction", "context_window": 32000, "alpha": 10.0},
    )
    assert create_response.status_code == 201
    payload = create_response.json()
    run_id = payload["id"]
    assert payload["predicted_max_depth"] == 39
    assert len(payload["nodes"]) == 1

    list_response = client.get("/api/runs")
    assert list_response.status_code == 200
    data = list_response.json()
    assert len(data) >= 1
    assert any(item["id"] == run_id for item in data)


def test_mock_step_and_events() -> None:
    create_response = client.post(
        "/api/runs",
        json={"problem_type": "prediction", "context_window": 32000, "alpha": 10.0},
    )
    run = create_response.json()
    run_id = run["id"]

    step_response = client.post(f"/api/runs/{run_id}/steps/mock")
    assert step_response.status_code == 200
    step_payload = step_response.json()
    assert step_payload["depth"] == 1
    assert step_payload["status"] in {"success", "fail", "error"}

    detail_response = client.get(f"/api/runs/{run_id}")
    detail = detail_response.json()
    assert len(detail["nodes"]) == 2
    assert detail["nodes"][-1]["depth"] == 1

    events_response = client.get(f"/api/runs/{run_id}/events")
    assert events_response.status_code == 200
    events_payload = events_response.json()
    assert events_payload["next_offset"] == 2
    assert events_payload["events"][-1]["type"] == "node.created"
