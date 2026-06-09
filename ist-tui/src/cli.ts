#!/usr/bin/env node
import { loadEnv } from "./core/env.js";
loadEnv(); // Load .env before anything else

import * as readline from "node:readline";
import * as path from "node:path";
import {
  createAppState, selectNode, addChildNode, deleteSelected,
  updateSelectedTitle, updateSelectedDescription,
  save, saveAs, open, startExperiment, stopExperiment,
  navigateUp, navigateDown,
  type AppState,
} from "./app.js";
import { renderTree } from "./tui/tree-view.js";
import { renderNodeDetail } from "./tui/node-detail.js";
import { renderLogPanel } from "./tui/log-panel.js";
import { theme } from "./tui/theme.js";
import { fileExists } from "./core/ist-file.js";

// ─── Terminal Setup ──────────────────────────────────────

let W = process.stdout.columns || 120;
let R = process.stdout.rows || 40;
process.stdout.on("resize", () => {
  W = process.stdout.columns || 120;
  R = process.stdout.rows || 40;
  render();
});

process.stdout.write("\x1b[?25l");
process.on("exit", () => process.stdout.write("\x1b[?25h\x1b[2J\x1b[H"));

if (!process.stdin.isTTY) {
  console.error("IST requires a terminal (TTY).");
  process.exit(1);
}

// ─── State ────────────────────────────────────────────────

let state: AppState = createAppState();
let editingField: "title" | "description" | null = null;
let editingValue = "";

const args = process.argv.slice(2);
let cliFilePath: string | null = null;
if (args.length > 0) {
  const given = path.resolve(args[0]);
  if (fileExists(given)) {
    open(state, given);
    cliFilePath = given;
  } else if (args[0].endsWith(".ist")) {
    // New file path specified
    cliFilePath = given;
  }
}

// ─── Render ──────────────────────────────────────────────

const DETAIL_LINES = 6;

function render(): void {
  // Compute footer height (from bottom up)
  let footer = 0;
  footer += 1; // key hints
  if (editingField) footer += 2; // edit bar + edit hints
  if (state.error) footer += 1; // error
  // detail area
  footer += DETAIL_LINES;
  footer += 1; // tree/detail separator

  // log panel when running
  let logLines: string[] = [];
  if (state.isRunning) {
    const maxLog = Math.max(4, R - 15);
    logLines = renderLogPanel(state.experimentLog, W);
    logLines = logLines.slice(0, maxLog);
    footer += 1 + logLines.length; // separator + log lines
  }

  const treeHeight = Math.max(5, R - 2 - footer); // -2 for status bar + separator
  const treeLines = renderTree(state.project, state.selectedId, W);
  const visibleTree = treeLines.slice(0, treeHeight);

  let out = "\x1b[2J\x1b[H";

  // ── Status ──
  const label = state.filePath ?? "Untitled";
  const dirty = state.isDirty ? " *" : "";
  const modelTag = theme.muted(` [${state.experimentConfig.provider}/${state.experimentConfig.model}]`);
  const runningTag = state.isRunning ? theme.running(" ⏳ Running...") : "";
  out += `${theme.bold("IST")} ${theme.muted(label + dirty)}${modelTag}${runningTag}`;
  out += " ".repeat(Math.max(0, W - label.length - dirty.length - 40)) + "\n";
  out += theme.muted("─".repeat(W)) + "\n";

  // ── Tree ──
  for (const line of visibleTree) out += line + "\n";
  for (let i = visibleTree.length; i < treeHeight; i++) out += "\n";

  // ── Detail separator ──
  out += theme.muted("─".repeat(W)) + "\n";

  // ── Detail ──
  const selNode = state.selectedId ? state.project.nodes[state.selectedId] ?? null : null;
  const dl = renderNodeDetail(selNode, W, state.isRunning);
  for (let i = 0; i < DETAIL_LINES; i++) out += (dl[i] ?? "") + "\n";

  // ── Log ──
  if (state.isRunning) {
    out += theme.muted("─".repeat(W)) + "\n";
    for (const ll of logLines) out += ll + "\n";
  }

  // ── Error ──
  if (state.error) out += theme.failed(`  ${state.error}`) + "\n";

  // ── Editing ──
  if (editingField) {
    const trimmed = editingValue.length > W - 20
      ? editingValue.slice(-(W - 25)) + "…"
      : editingValue;
    out += theme.accent(`  Editing ${editingField}: `) + trimmed + "\n";
    out += theme.muted("  [Enter] confirm  [Esc] cancel  [Tab] switch field") + "\n";
  }

  // ── Key hints ──
  out += theme.muted("  ↑↓ nav  i idea  e exp  r run  s save  Tab edit  del  q quit") + "\n";

  process.stdout.write(out);
}

// ─── Keyboard ─────────────────────────────────────────────

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on("keypress", async (_str, key) => {
  // ── Editing mode ──
  if (editingField) {
    const node = state.selectedId ? state.project.nodes[state.selectedId] : null;
    switch (key.name) {
      case "return":
      case "enter":
        if (node) {
          if (editingField === "title") updateSelectedTitle(state, editingValue);
          else updateSelectedDescription(state, editingValue);
        }
        editingField = null;
        editingValue = "";
        render();
        return;
      case "escape":
        editingField = null;
        editingValue = "";
        render();
        return;
      case "tab":
        if (editingField === "title") {
          editingField = "description";
          editingValue = node?.description ?? "";
        } else {
          editingField = null;
          editingValue = "";
        }
        render();
        return;
      case "backspace":
        editingValue = editingValue.slice(0, -1);
        render();
        return;
      default:
        if (key.sequence && key.sequence.length === 1 && key.sequence >= " ") {
          editingValue += key.sequence;
          render();
        }
        return;
    }
  }

  // ── Normal mode ──
  switch (key.name) {
    case "q": {
      if (key.ctrl) break;
      if (state.isDirty) {
        state.error = "Unsaved changes. Press Ctrl+Q to force quit, or s to save first.";
        render();
      } else cleanup();
      break;
    }
    case "up":    navigateUp(state); render(); break;
    case "down":  navigateDown(state); render(); break;

    case "tab": {
      if (!state.selectedId || state.isRunning) break;
      const n = state.project.nodes[state.selectedId];
      if (n) { editingField = "title"; editingValue = n.title; render(); }
      break;
    }
    case "i":
      if (!state.isRunning) { addChildNode(state, "idea"); render(); }
      break;
    case "e":
      if (!state.isRunning) { addChildNode(state, "experiment"); render(); }
      break;

    case "r":
      if (!state.isRunning && state.selectedId) {
        const n = state.project.nodes[state.selectedId];
        if (n?.type === "experiment") {
          state.error = null; render();
          await startExperiment(state, () => render());
          render();
        } else {
          state.error = "Select an experiment node (○ gray) to run."; render();
        }
      }
      break;

    case "s":
      if (key.ctrl) break;
      if (state.filePath) {
        save(state);
      } else {
        const p = cliFilePath ?? path.join(process.cwd(), "project.ist");
        saveAs(state, p);
        cliFilePath = p;
        state.error = `Saved to ${p}`;
      }
      render();
      break;

    case "delete":
    case "backspace":
      if (!state.isRunning && state.selectedId) {
        const n = state.project.nodes[state.selectedId];
        if (n && state.selectedId !== state.project.rootNodeId) {
          deleteSelected(state); render();
        }
      }
      break;

    case "escape":
      selectNode(state, null); render();
      break;

    default:
      if (key.ctrl && (key.name === "q" || key.name === "c")) cleanup();
      break;
  }
});

function cleanup(): void {
  process.stdout.write("\x1b[?25h\x1b[2J\x1b[H");
  process.exit(0);
}

render();
