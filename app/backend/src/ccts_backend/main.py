from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException

from .domain.ccts import compute_context_budget, is_feasible
from .schemas import CreateRunRequest, RunDetailResponse, RunListItem, StepResponse
from .store import STORE

app = FastAPI(title="CCTS Phase 1 MVP API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/runs", response_model=RunDetailResponse, status_code=201)
def create_run(payload: CreateRunRequest) -> RunDetailResponse:
    run = STORE.create_run(payload)
    detail = STORE.get_run_detail(run.id)
    if detail is None:
        raise HTTPException(status_code=500, detail="run creation failed")
    return detail


@app.get("/api/runs", response_model=list[RunListItem])
def list_runs() -> list[RunListItem]:
    return STORE.list_runs()


@app.get("/api/runs/{run_id}", response_model=RunDetailResponse)
def get_run_detail(run_id: str) -> RunDetailResponse:
    detail = STORE.get_run_detail(run_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="run not found")
    return detail


@app.post("/api/runs/{run_id}/steps/mock", response_model=StepResponse)
def mock_step(run_id: str) -> StepResponse:
    run = STORE.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")

    next_depth = run.latest_node_depth + 1
    c_hist, c_work = compute_context_budget(
        total_context=run.context_window,
        static_overhead=run.static_cost,
        mean_information_gain=run.delta_i,
        alpha=run.alpha,
        depth=next_depth,
    )
    if not is_feasible(
        total_context=run.context_window,
        static_overhead=run.static_cost,
        history_context=c_hist,
        task_demand=run.task_cost,
    ):
        STORE.mark_failed(run_id)
        raise HTTPException(status_code=409, detail="context budget exhausted")

    base_mae = max(3.5, 6.0 - next_depth * 0.08)
    mae = round(base_mae + random.uniform(-0.04, 0.04), 3)
    if mae <= 4.0:
        status = "success"
    elif next_depth % 7 == 0:
        status = "error"
    else:
        status = "fail"

    node = STORE.append_node(run_id=run_id, depth=next_depth, status=status, metric_value=mae)
    if node is None:
        raise HTTPException(status_code=500, detail="node append failed")

    if status == "success":
        STORE.mark_completed(run_id)

    STORE.append_event(
        run_id,
        {
            "type": "node.created",
            "run_id": run_id,
            "node_id": node.id,
            "depth": node.depth,
            "status": node.status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return StepResponse(
        run_id=run_id,
        node_id=node.id,
        depth=node.depth,
        status=node.status,  # type: ignore[arg-type]
        metric_name=node.metric_name,
        metric_value=node.metric_value,
        c_hist=node.c_hist,
        c_work=node.c_work,
        predicted_max_depth=run.predicted_depth,
    )


@app.get("/api/runs/{run_id}/events")
def get_run_events(run_id: str, since: int = 0) -> dict[str, Any]:
    if STORE.get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    events = STORE.get_events(run_id, since)
    return {"events": events, "next_offset": since + len(events)}
