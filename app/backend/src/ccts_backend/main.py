from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .domain.agent import propose_next
from .domain.ccts import compute_context_budget, is_feasible
from .domain.experiments import ExperimentConfig, run_experiment
from .domain.report import build_report
from .schemas import (
    AgentStepResponse,
    CreateRunRequest,
    ReportResponse,
    RunDetailResponse,
    RunListItem,
    StepResponse,
)
from .store import STORE

app = FastAPI(title="CCTS Research Agent API", version="0.2.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _event(run_id: str, node: Any, event_type: str = "node.created") -> None:
    STORE.append_event(
        run_id,
        {
            "type": event_type,
            "run_id": run_id,
            "node_id": node.id,
            "depth": node.depth,
            "status": node.status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/runs", response_model=RunDetailResponse, status_code=201)
def create_run(payload: CreateRunRequest) -> RunDetailResponse:
    if payload.mode == "real":
        run = STORE.create_run(payload, with_root=False)
        baseline_config = ExperimentConfig()  # historical-average climatology
        result = run_experiment(baseline_config)
        root = STORE.add_root_node(
            run.id,
            status="success",
            metric_value=result.mae,
            rmse=result.rmse,
            duration_s=result.duration_s,
            config=baseline_config.to_dict(),
            hypothesis=(
                "Establish a climatology baseline: average speed per time-of-day "
                "and weekend flag over the training weeks."
            ),
            action="baseline",
        )
        if root is not None:
            _event(run.id, root, "run.created")
    else:
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


@app.get("/api/runs/{run_id}/report", response_model=ReportResponse)
def get_run_report(run_id: str) -> ReportResponse:
    run = STORE.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return ReportResponse(run_id=run_id, markdown=build_report(run))


@app.post("/api/runs/{run_id}/steps/agent", response_model=AgentStepResponse)
def agent_step(run_id: str) -> AgentStepResponse:
    """Let the research agent run one real experiment (propose -> run -> judge)."""
    run = STORE.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    if run.mode != "real":
        raise HTTPException(status_code=400, detail="agent steps require a real-mode run")
    if run.status != "running":
        return AgentStepResponse(
            run_id=run_id,
            run_status=run.status,  # type: ignore[arg-type]
            reason=f"run already {run.status}",
            best_mae=run.best_mae,
            predicted_max_depth=run.predicted_depth,
            step_index=run.max_step_index,
        )

    next_step = run.max_step_index + 1
    c_hist, _ = compute_context_budget(
        total_context=run.context_window,
        static_overhead=run.static_cost,
        mean_information_gain=run.delta_i,
        alpha=run.alpha,
        depth=next_step,
    )
    if not is_feasible(
        total_context=run.context_window,
        static_overhead=run.static_cost,
        history_context=c_hist,
        task_demand=run.task_cost,
    ):
        STORE.mark_failed(run_id)
        return AgentStepResponse(
            run_id=run_id,
            run_status="failed",
            reason="context budget exhausted (c_work < D)",
            best_mae=run.best_mae,
            predicted_max_depth=run.predicted_depth,
            step_index=run.max_step_index,
        )

    rng = random.Random(f"{run_id}:{next_step}")
    proposal = propose_next(list(run.nodes), rng)
    if proposal is None:
        STORE.mark_completed(run_id)
        return AgentStepResponse(
            run_id=run_id,
            run_status="completed",
            reason="experiment design space exhausted",
            best_mae=run.best_mae,
            predicted_max_depth=run.predicted_depth,
            step_index=run.max_step_index,
        )

    parent = next((n for n in run.nodes if n.id == proposal.parent_id), None)
    try:
        result = run_experiment(proposal.config)
        improved = parent is not None and parent.metric_value is not None and result.mae < parent.metric_value
        status = "success" if improved else "fail"
        node = STORE.append_node(
            run_id=run_id,
            depth=(parent.depth + 1) if parent else 1,
            status=status,
            metric_value=result.mae,
            parent_id=proposal.parent_id,
            step_index=next_step,
            rmse=result.rmse,
            duration_s=result.duration_s,
            action=proposal.action,
            hypothesis=proposal.hypothesis,
            config=proposal.config.to_dict(),
        )
        reason = None
        if result.mae <= run.target_mae:
            STORE.mark_completed(run_id)
            reason = f"target MAE {run.target_mae:.2f} reached"
    except Exception as exc:  # experiment crashed: record and keep searching
        node = STORE.append_node(
            run_id=run_id,
            depth=(parent.depth + 1) if parent else 1,
            status="error",
            metric_value=None,
            parent_id=proposal.parent_id,
            step_index=next_step,
            action=proposal.action,
            hypothesis=proposal.hypothesis,
            config=proposal.config.to_dict(),
        )
        reason = f"experiment error: {exc}"

    if node is None:
        raise HTTPException(status_code=500, detail="node append failed")
    _event(run_id, node)

    refreshed = STORE.get_run(run_id)
    assert refreshed is not None
    return AgentStepResponse(
        run_id=run_id,
        run_status=refreshed.status,  # type: ignore[arg-type]
        reason=reason,
        node=node.to_schema(),
        best_mae=refreshed.best_mae,
        predicted_max_depth=refreshed.predicted_depth,
        step_index=next_step,
    )


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

    _event(run_id, node)

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
