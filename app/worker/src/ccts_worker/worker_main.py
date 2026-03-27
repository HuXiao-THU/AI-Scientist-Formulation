from __future__ import annotations

import argparse
import json

import httpx

from .mock_runner import build_worker_event


def main() -> None:
    parser = argparse.ArgumentParser(description="Phase 1 MVP mock worker")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000", help="Backend API base URL")
    parser.add_argument("--run-id", required=True, help="Run ID to advance once")
    args = parser.parse_args()

    with httpx.Client(base_url=args.api_base, timeout=20.0) as client:
        response = client.post(f"/api/runs/{args.run_id}/steps/mock")
        if response.status_code == 409:
            print(
                json.dumps(
                    build_worker_event(
                        run_id=args.run_id,
                        status="stopped",
                        detail="context budget exhausted",
                    ),
                    ensure_ascii=True,
                )
            )
            return
        response.raise_for_status()
        payload = response.json()
        print(
            json.dumps(
                build_worker_event(
                    run_id=payload["run_id"],
                    status=payload["status"],
                    detail=f"depth={payload['depth']}, mae={payload['metric_value']}",
                ),
                ensure_ascii=True,
            )
        )


if __name__ == "__main__":
    main()
