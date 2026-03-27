import React from "react";
import { createRoot } from "react-dom/client";
import { advanceRun, createRun, listRuns } from "./api";
import "./styles.css";

function depthRatio(current, predicted) {
  if (!predicted || predicted <= 0) return 0;
  return Math.min(100, Math.round((current / predicted) * 100));
}

function statusColor(status) {
  if (status === "completed") return "#0f766e";
  if (status === "running") return "#1d4ed8";
  if (status === "queued") return "#475569";
  return "#b91c1c";
}

function App() {
  const [runs, setRuns] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({ context_window: 32000, alpha: 10 });

  const refreshRuns = React.useCallback(async () => {
    try {
      const data = await listRuns();
      setRuns(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  React.useEffect(() => {
    refreshRuns();
    const timer = setInterval(refreshRuns, 3000);
    return () => clearInterval(timer);
  }, [refreshRuns]);

  async function onCreateRun(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createRun({
        problem_type: "prediction",
        context_window: Number(form.context_window),
        alpha: Number(form.alpha),
      });
      await refreshRuns();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAdvance(runId) {
    setBusy(true);
    setError("");
    try {
      await advanceRun(runId);
      await refreshRuns();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1 className="title">CCTS Phase 1 Run Overview</h1>
          <p className="subtitle">Prediction runs with context-constrained depth tracking.</p>
        </div>
      </div>

      <section className="card">
        <h2>Create Run</h2>
        <form onSubmit={onCreateRun} className="row-actions">
          <label>
            Context Window
            <input
              type="number"
              min="1"
              value={form.context_window}
              onChange={(e) => setForm((old) => ({ ...old, context_window: e.target.value }))}
            />
          </label>
          <label>
            Alpha
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={form.alpha}
              onChange={(e) => setForm((old) => ({ ...old, alpha: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Working..." : "Create Prediction Run"}
          </button>
        </form>
      </section>

      {error ? <section className="card" style={{ color: "#b91c1c" }}>{error}</section> : null}

      <section className="card">
        <h2>Runs</h2>
        {runs.length === 0 ? (
          <p className="hint">No runs yet. Create one to start testing.</p>
        ) : (
          <table className="run-list">
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Depth</th>
                <th>c_hist</th>
                <th>c_work</th>
                <th>Progress</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const ratio = depthRatio(run.current_depth, run.predicted_max_depth);
                return (
                  <tr key={run.id}>
                    <td>{run.id.slice(0, 8)}</td>
                    <td>
                      <span style={{ color: "white", background: statusColor(run.status), borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>
                        {run.status}
                      </span>
                    </td>
                    <td>{run.current_depth} / {run.predicted_max_depth}</td>
                    <td>{Math.round(run.c_hist)}</td>
                    <td>{Math.round(run.c_work)}</td>
                    <td>{ratio}%</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy || run.status === "completed" || run.status === "failed"}
                        onClick={() => onAdvance(run.id)}
                      >
                        Advance
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
