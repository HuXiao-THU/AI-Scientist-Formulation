const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${detail}`);
  }
  return response.json();
}

export function listRuns() {
  return request("/api/runs");
}

export function getRun(runId) {
  return request(`/api/runs/${runId}`);
}

export function createRun(payload) {
  return request("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function agentStep(runId) {
  return request(`/api/runs/${runId}/steps/agent`, { method: "POST" });
}

export function advanceRun(runId) {
  return request(`/api/runs/${runId}/steps/mock`, { method: "POST" });
}

export function getReport(runId) {
  return request(`/api/runs/${runId}/report`);
}
