from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import RLock
from typing import Any
from uuid import uuid4

from .domain.agent import short_label
from .domain.ccts import compute_context_budget, compute_depth_upper_bound
from .schemas import CreateRunRequest, NodeResponse, RunDetailResponse, RunListItem


@dataclass
class NodeRecord:
    id: str
    parent_id: str | None
    depth: int
    status: str
    metric_name: str
    metric_value: float | None
    c_hist: float
    c_work: float
    step_index: int = 0
    rmse: float | None = None
    duration_s: float | None = None
    action: str | None = None
    hypothesis: str | None = None
    config: dict[str, Any] | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(tz=UTC))

    def to_schema(self) -> NodeResponse:
        return NodeResponse(
            id=self.id,
            parent_id=self.parent_id,
            depth=self.depth,
            step_index=self.step_index,
            status=self.status,  # type: ignore[arg-type]
            metric_name=self.metric_name,
            metric_value=self.metric_value,
            rmse=self.rmse,
            duration_s=self.duration_s,
            action=self.action,
            hypothesis=self.hypothesis,
            label=short_label(self.config) if self.config else None,
            config=self.config,
            c_hist=self.c_hist,
            c_work=self.c_work,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


@dataclass
class RunRecord:
    id: str
    problem_type: str
    mode: str
    context_window: int
    summary_mode: str
    static_cost: int
    task_cost: int
    delta_i: int
    alpha: float
    target_mae: float
    status: str = "running"
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(tz=UTC))
    nodes: list[NodeRecord] = field(default_factory=list)
    events: list[dict[str, object]] = field(default_factory=list)

    @property
    def predicted_depth(self) -> int:
        return compute_depth_upper_bound(
            total_context=self.context_window,
            static_overhead=self.static_cost,
            task_demand=self.task_cost,
            mean_information_gain=self.delta_i,
            alpha=self.alpha,
        )

    @property
    def max_step_index(self) -> int:
        return max((node.step_index for node in self.nodes), default=0)

    @property
    def latest_node_depth(self) -> int:
        return max((node.depth for node in self.nodes), default=0)

    @property
    def latest_node(self) -> NodeRecord | None:
        if not self.nodes:
            return None
        return max(self.nodes, key=lambda n: n.step_index)

    @property
    def latest_node_id(self) -> str | None:
        node = self.latest_node
        return node.id if node else None

    @property
    def latest_c_hist(self) -> float:
        node = self.latest_node
        return node.c_hist if node else 0.0

    @property
    def latest_c_work(self) -> float:
        node = self.latest_node
        if node is None:
            return float(self.context_window - self.static_cost)
        return node.c_work

    @property
    def best_mae(self) -> float | None:
        values = [n.metric_value for n in self.nodes if n.metric_value is not None]
        return min(values) if values else None

    @property
    def best_node(self) -> NodeRecord | None:
        executed = [n for n in self.nodes if n.metric_value is not None]
        return min(executed, key=lambda n: n.metric_value) if executed else None

    def to_list_item(self) -> RunListItem:
        return RunListItem(
            id=self.id,
            problem_type=self.problem_type,  # type: ignore[arg-type]
            mode=self.mode,  # type: ignore[arg-type]
            status=self.status,  # type: ignore[arg-type]
            context_window=self.context_window,
            alpha=self.alpha,
            target_mae=self.target_mae,
            current_depth=self.max_step_index,
            predicted_max_depth=self.predicted_depth,
            leaf_node_id=self.latest_node_id,
            best_mae=self.best_mae,
            c_hist=self.latest_c_hist,
            c_work=self.latest_c_work,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    def to_detail(self) -> RunDetailResponse:
        return RunDetailResponse(
            id=self.id,
            problem_type=self.problem_type,  # type: ignore[arg-type]
            mode=self.mode,  # type: ignore[arg-type]
            status=self.status,  # type: ignore[arg-type]
            context_window=self.context_window,
            summary_mode=self.summary_mode,  # type: ignore[arg-type]
            static_cost=self.static_cost,
            task_cost=self.task_cost,
            delta_i=self.delta_i,
            alpha=self.alpha,
            target_mae=self.target_mae,
            predicted_max_depth=self.predicted_depth,
            best_mae=self.best_mae,
            nodes=[n.to_schema() for n in sorted(self.nodes, key=lambda item: item.step_index)],
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class InMemoryStore:
    def __init__(self) -> None:
        self._runs: dict[str, RunRecord] = {}
        self._lock = RLock()

    def create_run(self, payload: CreateRunRequest, with_root: bool = True) -> RunRecord:
        with self._lock:
            run_id = str(uuid4())
            run = RunRecord(
                id=run_id,
                problem_type=payload.problem_type,
                mode=payload.mode,
                context_window=payload.context_window,
                summary_mode=payload.summary_mode,
                static_cost=payload.static_cost,
                task_cost=payload.task_cost,
                delta_i=payload.delta_i,
                alpha=payload.alpha,
                target_mae=payload.target_mae,
            )
            self._runs[run_id] = run
            if with_root:
                root = NodeRecord(
                    id=str(uuid4()),
                    parent_id=None,
                    depth=0,
                    step_index=0,
                    status="success",
                    metric_name="mae",
                    metric_value=6.0,
                    c_hist=0.0,
                    c_work=float(payload.context_window - payload.static_cost),
                )
                run.nodes.append(root)
                run.events.append(
                    {
                        "type": "run.created",
                        "run_id": run_id,
                        "node_id": root.id,
                        "depth": 0,
                        "status": "success",
                        "timestamp": root.updated_at.isoformat(),
                    }
                )
            return run

    def list_runs(self) -> list[RunListItem]:
        with self._lock:
            runs = sorted(self._runs.values(), key=lambda r: r.created_at, reverse=True)
            return [run.to_list_item() for run in runs]

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def get_run_detail(self, run_id: str) -> RunDetailResponse | None:
        with self._lock:
            run = self._runs.get(run_id)
            return run.to_detail() if run else None

    def append_node(
        self,
        run_id: str,
        depth: int,
        status: str,
        metric_value: float | None,
        parent_id: str | None = None,
        step_index: int | None = None,
        **extras: Any,
    ) -> NodeRecord | None:
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return None
            resolved_step = step_index if step_index is not None else run.max_step_index + 1
            c_hist, c_work = compute_context_budget(
                total_context=run.context_window,
                static_overhead=run.static_cost,
                mean_information_gain=run.delta_i,
                alpha=run.alpha,
                depth=resolved_step,
            )
            node = NodeRecord(
                id=str(uuid4()),
                parent_id=parent_id if parent_id is not None else run.latest_node_id,
                depth=depth,
                step_index=resolved_step,
                status=status,
                metric_name="mae",
                metric_value=metric_value,
                c_hist=c_hist,
                c_work=c_work,
                **extras,
            )
            run.nodes.append(node)
            run.updated_at = node.updated_at
            return node

    def add_root_node(self, run_id: str, **kwargs: Any) -> NodeRecord | None:
        """Root node for real runs: parent-less, step 0, zero history cost."""
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return None
            node = NodeRecord(
                id=str(uuid4()),
                parent_id=None,
                depth=0,
                step_index=0,
                metric_name="mae",
                c_hist=0.0,
                c_work=float(run.context_window - run.static_cost),
                **kwargs,
            )
            run.nodes.append(node)
            run.updated_at = node.updated_at
            return node

    def mark_completed(self, run_id: str) -> None:
        with self._lock:
            run = self._runs.get(run_id)
            if run:
                run.status = "completed"
                run.updated_at = datetime.now(tz=UTC)

    def mark_failed(self, run_id: str) -> None:
        with self._lock:
            run = self._runs.get(run_id)
            if run:
                run.status = "failed"
                run.updated_at = datetime.now(tz=UTC)

    def append_event(self, run_id: str, event: dict[str, object]) -> None:
        with self._lock:
            run = self._runs.get(run_id)
            if run:
                run.events.append(event)

    def get_events(self, run_id: str, since: int) -> list[dict[str, object]]:
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return []
            return run.events[since:]


STORE = InMemoryStore()
