# AI-Scientist-Formulation

A GUI-based application for validating the **Context-Constrained Tree Search (CCTS)** framework, which models autonomous AI research as a tree search problem under LLM context window constraints.

The current release is a **Phase 1 MVP** focused on traffic prediction experiments with mock (simulated) execution.

## Architecture Overview

```
app/
├── backend/    # FastAPI REST API + CCTS domain logic (Python ≥ 3.11)
├── frontend/   # React + Vite single-page dashboard (Node.js)
└── worker/     # CLI tool to advance a run by one step via HTTP
```

| Layer    | Tech Stack                        | Storage          |
| -------- | --------------------------------- | ---------------- |
| Backend  | FastAPI, Pydantic v2, Uvicorn     | In-memory (dict) |
| Frontend | React 19, Vite 7                  | —                |
| Worker   | Python + httpx                    | —                |

## Features

- **CCTS formula engine** — computes depth upper bound `d*`, history context `c_hist`, work context `c_work`, and feasibility checks per the formal model.
- **Run management** — create prediction runs with configurable `context_window`, `alpha`, `static_cost`, `task_cost`, `delta_i`.
- **Mock experiment stepping** — each "Advance" simulates an experiment node with randomized MAE, automatically detecting context budget exhaustion.
- **Live dashboard** — table view with status, depth progress, `c_hist` / `c_work` tracking, and 3-second auto-refresh.
- **Event stream** — polling-based event API (`GET /api/runs/{id}/events?since=`) for run lifecycle events.

## Prerequisites

- **Python** ≥ 3.11
- **Node.js** ≥ 18 (with npm)

## Quick Start

### 1. Start the Backend

```bash
cd app/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn ccts_backend.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now available at `http://127.0.0.1:8000`. Verify with:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok"}
```

### 2. Start the Frontend

Open a new terminal:

```bash
cd app/frontend
npm install
npm run dev
```

Open `http://localhost:4173` in your browser to access the dashboard.

> To point the frontend at a different backend URL, set the `VITE_API_BASE_URL` environment variable before starting:
>
> ```bash
> VITE_API_BASE_URL=http://your-host:8000 npm run dev
> ```

### 3. Use the Dashboard

1. **Create a Run** — set `Context Window` (e.g. 32000) and `Alpha` (e.g. 10), then click **Create Prediction Run**.
2. **Advance** — click the **Advance** button to simulate one experiment step. Each step computes the new `c_hist` and `c_work`, and generates a mock MAE result.
3. **Observe** — watch the depth / predicted max depth, `c_hist` growing, and `c_work` shrinking as experiments accumulate.
4. The run will terminate with status `completed` (MAE ≤ 4.0) or `failed` (context budget exhausted, i.e. `c_work < D`).

### 4. (Optional) Use the Worker CLI

The worker can advance a run by one step from the command line:

```bash
cd app/worker
pip install -e .
python -m ccts_worker.worker_main --run-id <RUN_ID>
```

It calls `POST /api/runs/{run_id}/steps/mock` and prints a JSON event to stdout. Use `--api-base` to specify a non-default backend URL.

## API Reference

| Method | Endpoint                            | Description                      |
| ------ | ----------------------------------- | -------------------------------- |
| GET    | `/health`                           | Health check                     |
| POST   | `/api/runs`                         | Create a new run                 |
| GET    | `/api/runs`                         | List all runs                    |
| GET    | `/api/runs/{run_id}`                | Get run detail with all nodes    |
| POST   | `/api/runs/{run_id}/steps/mock`     | Advance run by one mock step     |
| GET    | `/api/runs/{run_id}/events?since=N` | Poll run events from offset `N`  |

### Create Run Payload

```json
{
  "problem_type": "prediction",
  "context_window": 32000,
  "alpha": 10.0,
  "static_cost": 3500,
  "task_cost": 8600,
  "delta_i": 50,
  "summary_mode": "structured"
}
```

All fields have defaults and are optional except that `context_window` and `alpha` are the primary knobs for experimentation.

## Running Tests

```bash
cd app/backend
pip install -e ".[dev]"
pytest -q
```

## CCTS Model (Brief)

The core formula computes the maximum research depth an AI agent can achieve:

```
d* = floor((C - S - D) / (α · ΔI))
```

Where:
- **C** — total context window (tokens)
- **S** — static overhead (system prompt + problem description)
- **D** — task demand (code + env + reasoning + output per experiment)
- **ΔI** — mean information gain per experiment
- **α** — compression ratio (ideal=1, actual LLM summarization ≈ 8–16)

See [research_plan.md](research_plan.md) for the full formal framework.

## Project Status

This is a **Phase 1 MVP**. Implemented:

- [x] CCTS formula engine (`d*`, `c_hist`, `c_work`, feasibility)
- [x] Backend REST API with in-memory store
- [x] Frontend run overview dashboard
- [x] Mock experiment stepping with context budget tracking
- [x] Backend unit tests

Not yet implemented:

- [ ] Persistent database (PostgreSQL)
- [ ] Real LLM integration and traffic prediction models
- [ ] Tree explorer visualization
- [ ] SSE / WebSocket real-time streaming
- [ ] Additional problem types (equilibrium, signal optimization)
- [ ] Compression ratio (`α`) measurement experiments
- [ ] Docker / Compose deployment
- [ ] CI/CD pipelines

## License

[Apache License 2.0](LICENSE)
