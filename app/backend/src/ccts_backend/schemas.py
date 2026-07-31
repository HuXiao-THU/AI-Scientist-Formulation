from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ProblemType = Literal["prediction"]
RunMode = Literal["mock", "real"]
RunStatus = Literal["queued", "running", "completed", "failed"]
NodeStatus = Literal["queued", "running", "success", "fail", "error", "blocked"]


class CreateRunRequest(BaseModel):
    problem_type: ProblemType = "prediction"
    mode: RunMode = "mock"
    context_window: int = Field(default=32000, ge=1)
    summary_mode: Literal["structured", "llm", "ideal"] = "structured"
    static_cost: int = Field(default=3500, ge=0)
    task_cost: int = Field(default=8600, ge=0)
    delta_i: int = Field(default=50, ge=1)
    alpha: float = Field(default=10.0, gt=0.0)
    target_mae: float = Field(default=2.5, gt=0.0)


class UpdateNodeRequest(BaseModel):
    status: Literal["success", "fail", "error"] = "success"
    metric_name: str = "mae"
    metric_value: float = 4.2


class RunListItem(BaseModel):
    id: str
    problem_type: ProblemType
    mode: RunMode
    status: RunStatus
    context_window: int
    alpha: float
    target_mae: float
    current_depth: int
    predicted_max_depth: int
    leaf_node_id: str | None
    best_mae: float | None
    c_hist: float
    c_work: float
    created_at: datetime
    updated_at: datetime


class NodeResponse(BaseModel):
    id: str
    parent_id: str | None
    depth: int
    step_index: int
    status: NodeStatus
    metric_name: str | None = None
    metric_value: float | None = None
    rmse: float | None = None
    duration_s: float | None = None
    action: str | None = None
    hypothesis: str | None = None
    label: str | None = None
    config: dict[str, Any] | None = None
    c_hist: float
    c_work: float
    created_at: datetime
    updated_at: datetime


class RunDetailResponse(BaseModel):
    id: str
    problem_type: ProblemType
    mode: RunMode
    status: RunStatus
    context_window: int
    summary_mode: Literal["structured", "llm", "ideal"]
    static_cost: int
    task_cost: int
    delta_i: int
    alpha: float
    target_mae: float
    predicted_max_depth: int
    best_mae: float | None
    nodes: list[NodeResponse]
    created_at: datetime
    updated_at: datetime


class StepResponse(BaseModel):
    run_id: str
    node_id: str
    depth: int
    status: Literal["success", "fail", "error"]
    metric_name: str
    metric_value: float
    c_hist: float
    c_work: float
    predicted_max_depth: int


class AgentStepResponse(BaseModel):
    run_id: str
    run_status: RunStatus
    reason: str | None = None
    node: NodeResponse | None = None
    best_mae: float | None = None
    predicted_max_depth: int
    step_index: int


class ReportResponse(BaseModel):
    run_id: str
    markdown: str
