from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ProblemType = Literal["prediction"]
RunStatus = Literal["queued", "running", "completed", "failed"]
NodeStatus = Literal["queued", "running", "success", "fail", "error", "blocked"]


class CreateRunRequest(BaseModel):
    problem_type: ProblemType = "prediction"
    context_window: int = Field(default=32000, ge=1)
    summary_mode: Literal["structured", "llm", "ideal"] = "structured"
    static_cost: int = Field(default=3500, ge=0)
    task_cost: int = Field(default=8600, ge=0)
    delta_i: int = Field(default=50, ge=1)
    alpha: float = Field(default=10.0, gt=0.0)


class UpdateNodeRequest(BaseModel):
    status: Literal["success", "fail", "error"] = "success"
    metric_name: str = "mae"
    metric_value: float = 4.2


class RunListItem(BaseModel):
    id: str
    problem_type: ProblemType
    status: RunStatus
    context_window: int
    alpha: float
    current_depth: int
    predicted_max_depth: int
    leaf_node_id: str | None
    c_hist: float
    c_work: float
    created_at: datetime
    updated_at: datetime


class NodeResponse(BaseModel):
    id: str
    parent_id: str | None
    depth: int
    status: NodeStatus
    metric_name: str | None = None
    metric_value: float | None = None
    c_hist: float
    c_work: float
    created_at: datetime
    updated_at: datetime


class RunDetailResponse(BaseModel):
    id: str
    problem_type: ProblemType
    status: RunStatus
    context_window: int
    summary_mode: Literal["structured", "llm", "ideal"]
    static_cost: int
    task_cost: int
    delta_i: int
    alpha: float
    predicted_max_depth: int
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
