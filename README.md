# AI-Scientist-Formulation

A GUI-based application for validating the **Context-Constrained Tree Search (CCTS)** framework, which models autonomous AI research as a tree search problem under LLM context window constraints.

The current release is a **Phase 2 demo**: a research agent that plans, runs and reports **real traffic-prediction experiments** (real models, real out-of-sample MAE) as a tree search under a context-window budget — plus a competition-ready **skill package** for the Tsinghua University AI Innovation Competition.

## Architecture Overview

```
app/
├── backend/    # FastAPI REST API + CCTS domain logic + real experiment engine (Python ≥ 3.11)
├── frontend/   # React + Vite research dashboard: tree view, MAE chart, budget bar (Node.js)
└── worker/     # CLI tool to advance a run by one step via HTTP
skills/
└── ccts-research-navigator/   # Standalone skill package (SKILL.md + scripts + templates + tests)
```

| Layer    | Tech Stack                        | Storage          |
| -------- | --------------------------------- | ---------------- |
| Backend  | FastAPI, Pydantic v2, Uvicorn     | In-memory (dict) |
| Frontend | React 19, Vite 7                  | —                |
| Worker   | Python + httpx                    | —                |

## Features

- **CCTS formula engine** — computes depth upper bound `d*`, history context `c_hist`, work context `c_work`, and feasibility checks per the formal model.
- **Real experiment engine** — deterministic corridor traffic dataset (rush-hour dips, day-to-day demand variability, incidents, autocorrelated noise) + five trainable models (climatology baseline, ridge, gradient boosting, random forest, MLP) with true chronological out-of-sample MAE/RMSE.
- **Research agent** — tree search over the experiment design space: picks a promising branch, states a natural-language hypothesis, mutates one factor, runs the experiment and judges the result. Stops when the target MAE is reached or the context budget is exhausted.
- **Research tree dashboard** — live SVG tree with best-path highlighting, experiment inspector (hypothesis + config + metrics), MAE convergence chart, context budget bar, and one-click **auto-generated research report** (downloadable markdown).
- **Skill package** — `skills/ccts-research-navigator/` wraps the same capabilities as three standalone CLI scripts (budget calculator, experiment runner, report generator) with SKILL.md metadata, templates, usage examples and tests.
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

1. **Launch a Research Run** — set `Context Window` (e.g. 32000), `α` (e.g. 10) and `Target MAE` (e.g. 2.5), then click **Launch Research Run**. The agent immediately executes a real climatology baseline.
2. **▶ Run Agent** — the agent loops hypothesis → experiment → analysis autonomously; watch the research tree grow, the MAE converge and the context budget drain in real time. Use **Single Step** for step-by-step control.
3. **Inspect** — click any tree node to see its hypothesis, configuration and metrics in the Experiment Inspector.
4. The run terminates `completed` (target MAE reached) or `failed` (context budget exhausted, i.e. `c_work < D`). Click **Research Report** for the auto-generated markdown report.

### 4. (Optional) Use the Worker CLI

The worker can advance a run by one step from the command line:

```bash
cd app/worker
pip install -e .
python -m ccts_worker.worker_main --run-id <RUN_ID>
```

It calls `POST /api/runs/{run_id}/steps/mock` and prints a JSON event to stdout. Use `--api-base` to specify a non-default backend URL.

## API Reference

| Method | Endpoint                            | Description                                     |
| ------ | ----------------------------------- | ----------------------------------------------- |
| GET    | `/health`                           | Health check                                    |
| POST   | `/api/runs`                         | Create a new run (`mode: "real"` runs baseline) |
| GET    | `/api/runs`                         | List all runs                                   |
| GET    | `/api/runs/{run_id}`                | Get run detail with all nodes (tree structure)  |
| POST   | `/api/runs/{run_id}/steps/agent`    | Agent runs one real experiment (propose→run)    |
| POST   | `/api/runs/{run_id}/steps/mock`     | Advance run by one mock step                    |
| GET    | `/api/runs/{run_id}/report`         | Auto-generated markdown research report         |
| GET    | `/api/runs/{run_id}/events?since=N` | Poll run events from offset `N`                 |

### Create Run Payload

```json
{
  "problem_type": "prediction",
  "mode": "real",
  "context_window": 32000,
  "alpha": 10.0,
  "static_cost": 3500,
  "task_cost": 8600,
  "delta_i": 50,
  "target_mae": 2.5,
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

## Tsinghua AI Innovation Competition (清华大学人工智能创新大赛)

This repository doubles as a competition entry:

- **智能体创新主赛事 · 科研助手赛道** — the dashboard demonstrates an autonomous research agent covering the full experimentation loop (hypothesis → real experiment → analysis → report) under an explicit, quantified context budget. The heuristic proposal policy in `app/backend/src/ccts_backend/domain/agent.py` is deliberately isolated behind `propose_next()` so the 清小搭 platform LLM can drive the same loop when deployed.
- **技能开发专项赛** — `skills/ccts-research-navigator/` is a standards-compliant skill package: `SKILL.md` with YAML metadata (name, description, version, triggers), executable `scripts/`, `templates/`, `resources/` with detailed usage examples, and `tests/`.

## Project Status

**Phase 2**. Implemented:

- [x] CCTS formula engine (`d*`, `c_hist`, `c_work`, feasibility)
- [x] Backend REST API with in-memory store
- [x] Real traffic-prediction experiment engine (5 models, reproducible metrics)
- [x] Tree-search research agent with natural-language hypotheses
- [x] Research tree visualization + MAE convergence chart + budget bar
- [x] Auto-generated markdown research report
- [x] Competition skill package with standalone CLI scripts
- [x] Backend + skill unit tests

Not yet implemented:

- [ ] Persistent database (PostgreSQL)
- [ ] LLM-driven proposal policy (drop-in replacement for `propose_next()`)
- [ ] SSE / WebSocket real-time streaming
- [ ] Additional problem types (equilibrium, signal optimization)
- [ ] Compression ratio (`α`) measurement experiments
- [ ] Docker / Compose deployment
- [ ] CI/CD pipelines

## License

[Apache License 2.0](LICENSE)
