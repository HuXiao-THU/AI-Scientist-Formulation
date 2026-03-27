# CCTS Phase 1 Worker

This worker can advance a prediction run by one mocked step.

## Usage

1. Start backend on `http://127.0.0.1:8000`.
2. Create a run via backend API (`POST /api/runs`) and get `run_id`.
3. Run worker:

```bash
python -m ccts_worker.worker_main --api-base http://127.0.0.1:8000 --run-id <RUN_ID>
```

It calls `POST /api/runs/{run_id}/steps/mock` once and prints a worker event JSON.
