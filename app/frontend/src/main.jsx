import React from "react";
import { createRoot } from "react-dom/client";
import { agentStep, createRun, getReport, getRun, listRuns } from "./api";
import { BudgetBar, MaeChart } from "./components/Charts";
import ReportModal from "./components/ReportModal";
import TreeView from "./components/TreeView";
import "./styles.css";

function statusClass(status) {
  return `pill pill-${status}`;
}

function StatCard({ label, value, sub, tone }) {
  return (
    <div className={`metric ${tone ? `metric-${tone}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}

function NodeDetail({ node }) {
  if (!node) {
    return <p className="hint">Click a node in the tree to inspect its hypothesis and configuration.</p>;
  }
  return (
    <div className="node-detail">
      <div className="node-detail-header">
        <span className="node-step">#{node.step_index}</span>
        <strong>{node.action ?? "baseline"}</strong>
        <span className={statusClass(node.status)}>{node.status}</span>
      </div>
      {node.hypothesis ? <p className="hypothesis">“{node.hypothesis}”</p> : null}
      <div className="kv-grid">
        <span>Model</span>
        <span>{node.config?.model ?? "—"}</span>
        <span>Lags</span>
        <span>{node.config?.n_lags ?? 0}</span>
        <span>Calendar features</span>
        <span>{node.config?.use_time_features ? "yes" : "no"}</span>
        <span>Rolling means</span>
        <span>{node.config?.use_rolling ? "yes" : "no"}</span>
        <span>Hyperparams</span>
        <span>
          {node.config && Object.keys(node.config.hyperparams ?? {}).length > 0
            ? Object.entries(node.config.hyperparams)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")
            : "defaults"}
        </span>
        <span>Test MAE</span>
        <span>{node.metric_value != null ? `${node.metric_value.toFixed(3)} km/h` : "—"}</span>
        <span>Test RMSE</span>
        <span>{node.rmse != null ? `${node.rmse.toFixed(3)} km/h` : "—"}</span>
        <span>Train time</span>
        <span>{node.duration_s != null ? `${node.duration_s.toFixed(2)} s` : "—"}</span>
      </div>
    </div>
  );
}

function App() {
  const [runs, setRuns] = React.useState([]);
  const [selectedRunId, setSelectedRunId] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [autoRunning, setAutoRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const [report, setReport] = React.useState(null);
  const [lastEvent, setLastEvent] = React.useState("");
  const [form, setForm] = React.useState({ context_window: 32000, alpha: 10, target_mae: 2.5 });
  const autoRef = React.useRef(false);

  const refreshRuns = React.useCallback(async () => {
    try {
      const data = await listRuns();
      setRuns(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const refreshDetail = React.useCallback(async (runId) => {
    if (!runId) return null;
    try {
      const data = await getRun(runId);
      setDetail(data);
      return data;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, []);

  React.useEffect(() => {
    refreshRuns();
    const timer = setInterval(refreshRuns, 4000);
    return () => clearInterval(timer);
  }, [refreshRuns]);

  React.useEffect(() => {
    refreshDetail(selectedRunId);
  }, [selectedRunId, refreshDetail]);

  React.useEffect(() => () => {
    autoRef.current = false;
  }, []);

  async function onCreateRun(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await createRun({
        problem_type: "prediction",
        mode: "real",
        context_window: Number(form.context_window),
        alpha: Number(form.alpha),
        target_mae: Number(form.target_mae),
      });
      await refreshRuns();
      setSelectedRunId(created.id);
      setSelectedNodeId(null);
      setLastEvent(`Baseline executed: MAE ${created.nodes[0]?.metric_value?.toFixed(3)} km/h`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function stepOnce(runId) {
    const body = await agentStep(runId);
    if (body.node) {
      setSelectedNodeId(body.node.id);
      setLastEvent(
        `#${body.node.step_index} ${body.node.action}: MAE ${body.node.metric_value?.toFixed(3)} km/h` +
          (body.reason ? ` — ${body.reason}` : ""),
      );
    } else if (body.reason) {
      setLastEvent(body.reason);
    }
    await refreshDetail(runId);
    await refreshRuns();
    return body;
  }

  async function onStep() {
    if (!selectedRunId) return;
    setBusy(true);
    setError("");
    try {
      await stepOnce(selectedRunId);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAutoRun() {
    if (!selectedRunId || autoRef.current) return;
    autoRef.current = true;
    setAutoRunning(true);
    setError("");
    try {
      // Propose -> run -> observe loop until target met or budget exhausted.
      for (let i = 0; i < 60 && autoRef.current; i += 1) {
        const body = await stepOnce(selectedRunId);
        if (body.run_status !== "running") break;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      autoRef.current = false;
      setAutoRunning(false);
    }
  }

  function onPause() {
    autoRef.current = false;
    setAutoRunning(false);
  }

  async function onShowReport() {
    if (!selectedRunId) return;
    setBusy(true);
    try {
      const body = await getReport(selectedRunId);
      setReport(body.markdown);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedNode = detail?.nodes?.find((n) => n.id === selectedNodeId) ?? null;
  const running = detail?.status === "running";

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1 className="title">
            CCTS Research Agent <span className="title-accent">· Autonomous Experimentation Lab</span>
          </h1>
          <p className="subtitle">
            An AI scientist that plans, runs and reports real traffic-prediction experiments under a
            context-window budget (Context-Constrained Tree Search).
          </p>
        </div>
        <span className="badge">Tsinghua AI Innovation Competition Demo</span>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="card">
            <h2>New Research Run</h2>
            <form onSubmit={onCreateRun} className="form-stack">
              <label>
                Context Window (tokens)
                <input
                  type="number"
                  min="1"
                  value={form.context_window}
                  onChange={(e) => setForm((old) => ({ ...old, context_window: e.target.value }))}
                />
              </label>
              <label>
                Compression Ratio α
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.alpha}
                  onChange={(e) => setForm((old) => ({ ...old, alpha: e.target.value }))}
                />
              </label>
              <label>
                Target MAE (km/h)
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.target_mae}
                  onChange={(e) => setForm((old) => ({ ...old, target_mae: e.target.value }))}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={busy || autoRunning}>
                {busy ? "Working…" : "Launch Research Run"}
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Runs</h2>
            {runs.length === 0 ? (
              <p className="hint">No runs yet.</p>
            ) : (
              <ul className="run-cards">
                {runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      className={`run-card ${run.id === selectedRunId ? "run-card-active" : ""}`}
                      onClick={() => {
                        setSelectedRunId(run.id);
                        setSelectedNodeId(null);
                      }}
                    >
                      <div className="run-card-top">
                        <span className="mono">{run.id.slice(0, 8)}</span>
                        <span className={statusClass(run.status)}>{run.status}</span>
                      </div>
                      <div className="run-card-bottom">
                        <span>
                          {run.current_depth}/{run.predicted_max_depth} exp
                        </span>
                        <span>{run.best_mae != null ? `best ${run.best_mae.toFixed(2)}` : "—"}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <div className="main-col">
          {error ? <section className="card error-card">{error}</section> : null}

          {!detail ? (
            <section className="card">
              <p className="hint">
                Launch a research run: the agent will establish a baseline, then iterate hypothesis →
                experiment → analysis until the target MAE is reached or the context budget runs out.
              </p>
            </section>
          ) : (
            <>
              <section className="card">
                <div className="run-header">
                  <h2 style={{ margin: 0 }}>
                    Run <span className="mono">{detail.id.slice(0, 8)}</span>{" "}
                    <span className={statusClass(detail.status)}>{detail.status}</span>
                  </h2>
                  <div className="row-actions">
                    {autoRunning ? (
                      <button type="button" className="btn-secondary" onClick={onPause}>
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy || !running}
                        onClick={onAutoRun}
                      >
                        ▶ Run Agent
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy || autoRunning || !running}
                      onClick={onStep}
                    >
                      Single Step
                    </button>
                    <button type="button" className="btn-secondary" disabled={busy} onClick={onShowReport}>
                      Research Report
                    </button>
                  </div>
                </div>
                {lastEvent ? <p className="event-line">{lastEvent}</p> : null}
                <div className="grid">
                  <StatCard
                    label="Best Test MAE"
                    value={detail.best_mae != null ? detail.best_mae.toFixed(3) : "—"}
                    sub={`target ≤ ${detail.target_mae.toFixed(2)} km/h`}
                    tone={detail.best_mae != null && detail.best_mae <= detail.target_mae ? "good" : undefined}
                  />
                  <StatCard
                    label="Experiments Used"
                    value={`${Math.max(...detail.nodes.map((n) => n.step_index), 0)} / ${detail.predicted_max_depth}`}
                    sub="depth bound d* from CCTS"
                  />
                  <StatCard
                    label="Context Window"
                    value={detail.context_window.toLocaleString("en-US")}
                    sub={`α = ${detail.alpha}, ΔI = ${detail.delta_i} tokens/exp`}
                  />
                  <StatCard
                    label="Remaining c_work"
                    value={Math.round(
                      detail.nodes.reduce(
                        (acc, n) => Math.min(acc, n.c_work),
                        detail.context_window - detail.static_cost,
                      ),
                    ).toLocaleString("en-US")}
                    sub={`task demand D = ${detail.task_cost.toLocaleString("en-US")}`}
                  />
                </div>
                <div style={{ marginTop: 14 }}>
                  <BudgetBar run={detail} />
                </div>
              </section>

              <div className="two-col">
                <section className="card">
                  <h2>Research Tree</h2>
                  <TreeView nodes={detail.nodes} selectedId={selectedNodeId} onSelect={setSelectedNodeId} />
                </section>
                <section className="card">
                  <h2>Experiment Inspector</h2>
                  <NodeDetail node={selectedNode} />
                </section>
              </div>

              <section className="card">
                <h2>MAE Convergence</h2>
                <MaeChart nodes={detail.nodes} targetMae={detail.target_mae} />
              </section>
            </>
          )}
        </div>
      </div>

      {report != null ? <ReportModal markdown={report} onClose={() => setReport(null)} /> : null}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
