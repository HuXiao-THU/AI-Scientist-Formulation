# Repository Structure Draft (GUI + Experiment Validation)

> Goal: Build a GUI-based application to validate CCTS ideas and keep humans continuously informed of experiment progress.

## 1) Top-level Structure

```text
ai-scientist-formulation/
├── README.md
├── repo_structure_draft.md
├── docs/
│   ├── architecture/
│   │   ├── ccts_model.md
│   │   ├── data_flow.md
│   │   └── decisions/
│   ├── experiments/
│   │   ├── phase1_prediction.md
│   │   ├── phase2_cross_problem.md
│   │   └── metrics_definition.md
│   └── ops/
│       ├── runbook.md
│       └── alerting.md
├── app/
│   ├── frontend/                    # GUI (React/Next.js)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── index.tsx        # Run overview
│   │   │   │   ├── runs/[id].tsx    # Run detail
│   │   │   │   ├── tree/[id].tsx    # Tree explorer
│   │   │   │   └── alerts.tsx
│   │   │   ├── components/
│   │   │   │   ├── run/
│   │   │   │   ├── tree/
│   │   │   │   ├── charts/
│   │   │   │   └── common/
│   │   │   ├── services/
│   │   │   │   ├── api.ts
│   │   │   │   └── stream.ts        # SSE/WebSocket client
│   │   │   ├── store/
│   │   │   ├── styles/
│   │   │   └── types/
│   │   ├── public/
│   │   ├── tests/
│   │   └── package.json
│   ├── backend/                     # API + orchestration (FastAPI)
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── api/
│   │   │   │   ├── runs.py
│   │   │   │   ├── nodes.py
│   │   │   │   ├── metrics.py
│   │   │   │   ├── tokens.py
│   │   │   │   └── stream.py
│   │   │   ├── core/
│   │   │   │   ├── config.py
│   │   │   │   ├── logging.py
│   │   │   │   └── security.py
│   │   │   ├── domain/
│   │   │   │   ├── problems.py      # prediction / equilibrium / signal
│   │   │   │   ├── ccts.py          # formulas and feasibility checks
│   │   │   │   ├── planner.py       # node expansion strategy
│   │   │   │   └── accountant.py    # token accounting
│   │   │   ├── db/
│   │   │   │   ├── models.py
│   │   │   │   ├── session.py
│   │   │   │   └── migrations/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   │   ├── run_service.py
│   │   │   │   ├── node_service.py
│   │   │   │   ├── metric_service.py
│   │   │   │   └── event_service.py
│   │   │   └── utils/
│   │   ├── tests/
│   │   └── pyproject.toml
│   └── worker/                      # async experiment execution
│       ├── src/
│       │   ├── worker_main.py
│       │   ├── tasks/
│       │   │   ├── execute_node.py
│       │   │   ├── summarize_history.py
│       │   │   ├── compute_alpha.py
│       │   │   └── emit_events.py
│       │   ├── adapters/
│       │   │   ├── llm_client.py
│       │   │   ├── simulator_client.py
│       │   │   └── artifact_store.py
│       │   └── runners/
│       │       ├── prediction_runner.py
│       │       ├── equilibrium_runner.py
│       │       └── signal_runner.py
│       ├── tests/
│       └── pyproject.toml
├── shared/
│   ├── contracts/
│   │   ├── events.json
│   │   └── api.yaml
│   ├── constants/
│   └── scripts/
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.backend
│   │   └── Dockerfile.worker
│   ├── compose/
│   │   └── docker-compose.dev.yml   # postgres + redis + minio + app
│   ├── k8s/
│   └── terraform/
├── data/
│   ├── raw/
│   ├── processed/
│   └── external/
├── artifacts/
│   ├── runs/
│   └── reports/
├── notebooks/
│   ├── calibration/
│   └── analysis/
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── fixtures/
└── .github/
    └── workflows/
        ├── ci_frontend.yml
        ├── ci_backend.yml
        └── ci_worker.yml
```

## 2) Directory Responsibilities

- `app/frontend`: Human-facing GUI for run monitoring, tree exploration, and alert dashboards.
- `app/backend`: API layer, domain logic, CCTS calculations, token accounting, and event streaming.
- `app/worker`: Async execution of experiments, summaries, alpha measurement, and artifact generation.
- `shared/contracts`: API/Event contracts used by frontend/backend/worker to avoid schema drift.
- `infra`: Local and cloud deployment assets.
- `docs`: Design records, experiment plans, and operations guidance.

## 3) Suggested Build Order

1. Create `app/backend` with health check + run creation API.
2. Create `app/worker` with a mock `execute_node` task and event emission.
3. Create `app/frontend` with Run Overview page subscribing to stream.
4. Add database schema (`runs`, `nodes`, `token_breakdown`, `metrics`, `events`).
5. Integrate CCTS accountant (`c_hist`, `c_work`, `d*`, `alpha`) and chart views.
6. Add Phase 1 prediction runner, then extend to cross-problem runners.

## 4) Naming and Conventions

- Use snake_case for Python files and event names.
- Use kebab-case for docs and decision records.
- Keep all GUI labels in English for consistency.
- Keep experiment node payloads JSON-serializable for replay and audit.
