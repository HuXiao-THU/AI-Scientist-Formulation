# Backend (Phase 1 MVP)

Run locally:

1. `python -m venv .venv`
2. `source .venv/bin/activate`
3. `pip install -e .[dev]`
4. `uvicorn ccts_backend.main:app --reload --host 0.0.0.0 --port 8000`

Run tests:

- `pytest -q`
