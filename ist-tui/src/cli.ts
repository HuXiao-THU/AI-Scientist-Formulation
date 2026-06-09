#!/usr/bin/env node
import * as readline from "node:readline";
import {
  createAppState,
  selectNode,
  addChildNode,
  deleteSelected,
  updateSelectedTitle,
  updateSelectedDescription,
  save,
  saveAs,
  open,
  startExperiment,
  stopExperiment,
  navigateUp,
  navigateDown,
  type AppState,
} from "./app.js";
import { renderTree } from "./tui/tree-view.js";
import { renderNodeDetail } from "./tui/node-detail.js";
import { renderLogPanel, ExperimentLog } from "./tui/log-panel.js";
import { theme } from "./tui/theme.js";
import { fileExists } from "./core/ist-file.js";

// ─── Terminal Setup ──────────────────────────────────────

let screenCols = process.stdout.columns || 120;
let screenRows = process.stdout.rows || 40;

process.stdout.on("resize", () => {
  screenCols = process.stdout.columns || 120;
  screenRows = process.stdout.rows || 40;
  render();
});

process.stdout.write("\x1b[?25l"); // hide cursor
process.on("exit", () => {
  process.stdout.write("\x1b[?25h\x1b[2J\x1b[H");
});

if (!process.stdin.isTTY) {
  console.error("IST requires a terminal (TTY).");
  process.exit(1);
}

// ─── State ────────────────────────────────────────────────

let state: AppState = createAppState();
let editingField: "title" | "description" | null = null;
let editingValue = "";

const args = process.argv.slice(2);
if (args.length > 0 && fileExists(args[0])) {
  open(state, args[0]);
}

// ─── Layout ───────────────────────────────────────────────

function render(): void {
  const W = screenCols;
  const R = screenRows;

  // Reserve space: status (1) + separator (1) + detail (max 6) + hints (1) = 9
  // Plus a blank line before log section
  const detailHeight = 6;
  const logHeight = state.isRunning ? Math.max(6, R - 15) : 0;
  const treeHeight = Math.max(5, R - 3 - detailHeight - logHeight - 1);

  let out = "\x1b[2J\x1b[H";

  // ── Status bar ──
  const fileLabel = state.filePath ?? "Untitled";
  const dirty = state.isDirty ? " *" : "";
  const running = state.isRunning ? theme.running(" ⏳ Running...") : "";
  out += `${theme.bold("IST")} ${theme.muted(fileLabel + dirty)}${running}`;
  out += " ".repeat(Math.max(0, W - fileLabel.length - dirty.length - 20)) + "\n";
  out += theme.muted("─".repeat(W)) + "\n";

  // ── Tree section ──
  const treeLines = renderTree(state.project, state.selectedId, W);
  const visibleTree = treeLines.slice(0, treeHeight);
  for (const line of visibleTree) {
    out += line + "\n";
  }
  // Pad remaining tree area
  for (let i = visibleTree.length; i < treeHeight; i++) {
    out += "\n";
  }

  // ── Separator ──
  out += theme.muted("─".repeat(W)) + "\n";

  // ── Selected node detail (compact) ──
  const selNode = state.selectedId
    ? state.project.nodes[state.selectedId] ?? null
    : null;
  const detailLines = renderNodeDetail(selNode, W, state.isRunning);
  for (let i = 0; i < detailHeight; i++) {
    out += (detailLines[i] ?? "") + "\n";
  }

  // ── Log panel (when running) ──
  if (state.isRunning) {
    out += theme.muted("─".repeat(W)) + "\n";
    const logLines = renderLogPanel(state.experimentLog, W);
    for (let i = 0; i < Math.min(logLines.length, logHeight); i++) {
      out += logLines[i] + "\n";
    }
  }

  // ── Error ──
  if (state.error) {
    out += theme.failed(`  ${state.error}`) + "\n";
  }

  // ── Editing bar ──
  if (editingField) {
    out += "\n";
    out += theme.accent(`  Editing ${editingField}: `) + editingValue;
    out += theme.muted("  [Enter] confirm  [Esc] cancel  [Tab] switch field");
  }

  // ── Key hints ──
  out += "\n" + theme.muted(
    "  ↑↓ nav  i idea  e exp  r run  s save  Tab edit  del  q quit"
  );

  process.stdout.write(out);
}

// ─── Keyboard Input ──────────────────────────────────────

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on("keypress", async (_str, key) => {
  // ── Editing mode ──
  if (editingField) {
    switch (key.name) {
      case "return":
      case "enter": {
        const node = state.selectedId
          ? state.project.nodes[state.selectedId]
          : null;
        if (node) {
          if (editingField === "title") updateSelectedTitle(state, editingValue);
          else updateSelectedDescription(state, editingValue);
        }
        editingField = null;
        editingValue = "";
        render();
        return;
      }
      case "escape":
        editingField = null;
        editingValue = "";
        render();
        return;
      case "tab": {
        // Cycle to next field (or exit)
        const node = state.selectedId
          ? state.project.nodes[state.selectedId]
          : null;
        if (editingField === "title" && node) {
          editingField = "description";
          editingValue = node.description;
        } else {
          editingField = null;
          editingValue = "";
        }
        render();
        return;
      }
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
    case "q":
      if (key.ctrl) break;
      if (state.isDirty) {
        state.error = "Unsaved changes. Press Ctrl+Q to force quit, or s to save.";
        render();
      } else {
        cleanup();
      }
      break;

    case "up":
      navigateUp(state);
      render();
      break;

    case "down":
      navigateDown(state);
      render();
      break;

    case "tab": {
      if (!state.selectedId || state.isRunning) break;
      const node = state.project.nodes[state.selectedId];
      if (node) {
        editingField = "title";
        editingValue = node.title;
        render();
      }
      break;
    }

    case "i":
      if (!state.isRunning) {
        addChildNode(state, "idea");
        render();
      }
      break;

    case "e":
      if (!state.isRunning) {
        addChildNode(state, "experiment");
        render();
      }
      break;

    case "r":
      if (!state.isRunning && state.selectedId) {
        const node = state.project.nodes[state.selectedId];
        if (node?.type === "experiment") {
          state.error = null;
          render();
          await startExperiment(state, () => render());
          render();
        } else {
          state.error = "Select an experiment node (○ gray) to run.";
          render();
        }
      }
      break;

    case "s":
      if (key.ctrl) break;
      if (state.filePath) {
        save(state);
      } else {
        const p = "/tmp/ist-project.ist";
        saveAs(state, p);
        state.error = `Saved to ${p}. Use "ist /path/to/file.ist" to specify.`;
      }
      render();
      break;

    case "delete":
    case "backspace":
      if (!state.isRunning && state.selectedId) {
        const node = state.project.nodes[state.selectedId];
        if (node && state.selectedId !== state.project.rootNodeId) {
          deleteSelected(state);
          render();
        }
      }
      break;

    case "escape":
      selectNode(state, null);
      render();
      break;

    default:
      if (key.ctrl && (key.name === "q" || key.name === "c")) {
        cleanup();
      }
      break;
  }
});

function cleanup(): void {
  process.stdout.write("\x1b[?25h\x1b[2J\x1b[H");
  process.exit(0);
}

// ─── Initial render ──────────────────────────────────────
render();
