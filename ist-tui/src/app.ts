import {
  createProject,
  loadProject,
  saveProject,
  fileExists,
  workspacePath,
} from "./core/ist-file.js";
import {
  addChild,
  deleteNode,
  updateNode,
  getPathToRoot,
  getSubtree,
  getChildren,
} from "./core/tree-model.js";
import { runExperiment } from "./core/experiment.js";
import type {
  ISTProject,
  ISTNode,
  ExperimentConfig,
  ExperimentRunResult,
  ExperimentLogEvent,
} from "./core/types.js";
import { renderTree } from "./tui/tree-view.js";
import { renderNodeDetail } from "./tui/node-detail.js";
import { ExperimentLog, renderLogPanel } from "./tui/log-panel.js";
import { theme } from "./tui/theme.js";
import { safeErrorMessage } from "./utils/truncate.js";

// ─── App State ───────────────────────────────────────────

export interface AppState {
  project: ISTProject;
  filePath: string | null;
  selectedId: string | null;
  isDirty: boolean;
  isRunning: boolean;
  experimentLog: ExperimentLog;
  experimentConfig: ExperimentConfig;
  error: string | null;
  editing: EditingState | null;
}

export interface EditingState {
  field: "title" | "description";
  value: string;
}

export function createAppState(): AppState {
  const project = createProject();
  return {
    project,
    filePath: null,
    selectedId: project.rootNodeId,
    isDirty: false,
    isRunning: false,
    experimentLog: new ExperimentLog(),
    experimentConfig: {
      provider: "deepseek",
      model: "deepseek-v4-pro",
      baseUrl: "https://api.deepseek.com",
    },
    error: null,
    editing: null,
  };
}

// ─── Actions ──────────────────────────────────────────────

export function selectNode(state: AppState, id: string | null): void {
  state.selectedId = id;
  state.editing = null;
}

export function addChildNode(
  state: AppState,
  type: "idea" | "experiment"
): void {
  if (!state.selectedId) return;
  try {
    const id = addChild(state.project, state.selectedId, type);
    state.selectedId = id;
    state.isDirty = true;
    state.error = null;
  } catch (err) {
    state.error = safeErrorMessage(err);
  }
}

export function deleteSelected(state: AppState): void {
  if (!state.selectedId) return;
  const node = state.project.nodes[state.selectedId];
  if (!node) return;
  if (state.selectedId === state.project.rootNodeId) return;

  // Confirm deletion of non-empty nodes
  deleteNode(state.project, state.selectedId);
  state.selectedId = state.project.rootNodeId;
  state.isDirty = true;
}

export function updateSelectedTitle(state: AppState, title: string): void {
  if (!state.selectedId) return;
  updateNode(state.project, state.selectedId, { title });
  state.isDirty = true;
}

export function updateSelectedDescription(
  state: AppState,
  description: string
): void {
  if (!state.selectedId) return;
  updateNode(state.project, state.selectedId, { description });
  state.isDirty = true;
}

export function save(state: AppState): void {
  if (!state.filePath) return;
  try {
    // Persist workspace path in meta
    if (!state.project.meta.workspacePath) {
      state.project.meta.workspacePath = workspacePath(state.filePath);
    }
    saveProject(state.filePath, state.project);
    state.isDirty = false;
    state.error = null;
  } catch (err) {
    state.error = safeErrorMessage(err);
  }
}

export function saveAs(state: AppState, filePath: string): void {
  state.filePath = filePath;
  state.project.meta.workspacePath = workspacePath(filePath);
  save(state);
}

export function open(state: AppState, filePath: string): void {
  try {
    state.project = loadProject(filePath);
    state.filePath = filePath;
    state.selectedId = state.project.rootNodeId;
    state.isDirty = false;
    state.error = null;
  } catch (err) {
    state.error = `Failed to open: ${safeErrorMessage(err)}`;
  }
}

export async function startExperiment(
  state: AppState,
  onLog: (e: ExperimentLogEvent) => void
): Promise<ExperimentRunResult | null> {
  if (!state.selectedId) return null;
  const node = state.project.nodes[state.selectedId];
  if (!node || node.type !== "experiment") {
    state.error = "Select an experiment node to run.";
    return null;
  }
  if (!node.description.trim()) {
    state.error = "Please enter an experiment description first.";
    return null;
  }

  const wsPath =
    state.project.meta.workspacePath ||
    (state.filePath ? workspacePath(state.filePath) : "/tmp/ist-workspace");

  state.isRunning = true;
  state.experimentLog.clear();
  state.error = null;

  const controller = new AbortController();
  (state as any)._abortController = controller;

  const result = await runExperiment(
    state.project,
    node,
    wsPath,
    state.experimentConfig,
    (event) => {
      state.experimentLog.append(event);
      onLog(event);
    },
    controller.signal
  );

  // Update node with result
  updateNode(state.project, node.id, {
    runStatus: result.success ? "done" : "failed",
    experimentResult: result.summary || result.error || "",
    gitBranch: result.gitBranch,
  });

  state.isRunning = false;
  state.isDirty = true;
  (state as any)._abortController = null;

  return result;
}

export function stopExperiment(state: AppState): void {
  const controller = (state as any)._abortController as AbortController | null;
  if (controller) {
    controller.abort();
    state.isRunning = false;
  }
}

export function aiSummarize(state: AppState): void {
  // Placeholder — will be implemented with agent call
  state.error = "AI Summarize: not yet implemented (will use agent)";
}

// ─── Navigation ──────────────────────────────────────────

/** Get flat list of visible node IDs for up/down navigation */
export function getVisibleNodes(state: AppState): string[] {
  const ids: string[] = [];
  const visited = new Set<string>();

  function walk(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    ids.push(nodeId);
    // Sort children consistently with flattenTree (by creation time)
    const children = getChildren(state.project, nodeId);
    for (const child of children) {
      walk(child.id);
    }
  }

  walk(state.project.rootNodeId);
  return ids;
}

export function navigateUp(state: AppState): void {
  const visible = getVisibleNodes(state);
  if (visible.length === 0) return;
  if (!state.selectedId) {
    state.selectedId = visible[visible.length - 1];
    return;
  }
  const idx = visible.indexOf(state.selectedId);
  if (idx > 0) state.selectedId = visible[idx - 1];
}

export function navigateDown(state: AppState): void {
  const visible = getVisibleNodes(state);
  if (visible.length === 0) return;
  if (!state.selectedId) {
    state.selectedId = visible[0];
    return;
  }
  const idx = visible.indexOf(state.selectedId);
  if (idx >= 0 && idx < visible.length - 1) {
    state.selectedId = visible[idx + 1];
  }
}
