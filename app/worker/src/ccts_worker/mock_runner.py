from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass(slots=True)
class WorkerEvent:
    run_id: str
    status: str
    detail: str
    timestamp: str


def build_worker_event(run_id: str, status: str, detail: str) -> dict[str, Any]:
    event = WorkerEvent(
        run_id=run_id,
        status=status,
        detail=detail,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    return asdict(event)
