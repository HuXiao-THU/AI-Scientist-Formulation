const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function listRuns() {
  const response = await fetch(`${API_BASE}/api/runs`);
  if (!response.ok) {
    throw new Error(`Failed to list runs: ${response.status}`);
  }
  return response.json();
}

export async function createRun(payload) {
  const response = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to create run: ${response.status}`);
  }
  return response.json();
}

export async function advanceRun(runId) {
  const response = await fetch(`${API_BASE}/api/runs/${runId}/steps/mock`, {
    method: "POST",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to advance run: ${response.status} ${detail}`);
  }
  return response.json();
}
