#!/usr/bin/env node
import * as readline from "node:readline";
import * as fs from "node:fs";
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
import { renderLogPanel } from "./tui/log-panel.js";
import { theme } from "./tui/theme.js";
import { fileExists } from "./core/ist-file.js";

// ─── Terminal Setup ──────────────────────────────────────

let screenRows = process.stdout.rows || 40;
let screenCols = process.stdout.columns || 120;

process.stdout.on("resize", () => {
  screenRows = process.stdout.rows || 40;
  screenCols = process.stdout.columns || 120;
  render();
});

// Hide cursor
process.stdout.write("\x1b[?25l");
process.on("exit", () => {
  process.stdout.write("\x1b[?25h");
  process.stdout.write("\x1b[2J\x1b[H");
});

// ─── State ────────────────────────────────────────────────

let state: AppState = createAppState();
let editingField: "title" | "description" | null = null;
let editingValue = "";

// Parse CLI args for file path
const args = process.argv.slice(2);
if (args.length > 0 && fileExists(args[0])) {
  open(state, args[0]);
}

// ─── Render ───────────────────────────────────────────────

function render(): void {
  const cols = screenCols;
  const rows = screenRows;

  // Clear screen and move to home
  let output = "\x1b[2J\x1b[H";

  // ── Status bar ──
  const fileLabel = state.filePath ?? "Untitled";
  const dirty = state.isDirty ? " *" : "";
  const running = state.isRunning ? theme.running(" ⏳ Running...") : "";
  const statusBar = `${theme.bold("IST")} ${theme.muted(fileLabel + dirty)}${running}`;
  output += statusBar + "\n";
  output += theme.muted("─".repeat(cols)) + "\n";

  // ── Main area ──
  const detailWidth = Math.floor(cols * 0.35);
  const treeWidth = cols - detailWidth;
  const treeHeight = Math.max(5, rows - 15);

  const selectedNode = state.selectedId
    ? state.project.nodes[state.selectedId] ?? null
    : null;

  // Render tree
  const treeLines = renderTree(state.project, state.selectedId, treeWidth);

  // Render detail panel
  const detailLines = renderNodeDetail(selectedNode, detailWidth, state.isRunning);

  // Render side by side — pad missing lines to keep alignment
  const emptyTreePad = " ".repeat(treeWidth);
  const emptyDetailPad = " ".repeat(detailWidth);
  const mainHeight = Math.max(treeLines.length, detailLines.length, treeHeight);
  for (let i = 0; i < mainHeight; i++) {
    const treeLine = treeLines[i] ?? emptyTreePad;
    const detailLine = detailLines[i] ?? emptyDetailPad;
    output += treeLine + detailLine + "\n";
  }

  // ── Log Panel ──
  const logHeight = Math.max(5, rows - mainHeight - 5);
  const remainingRows = rows - mainHeight - 5;
  output += "\n";
  const logLines = renderLogPanel(state.experimentLog, cols);
  for (let i = 0; i < Math.min(logLines.length, remainingRows); i++) {
    output += logLines[i] + "\n";
  }

  // ── Error ──
  if (state.error) {
    output += theme.failed(`  ERROR: ${state.error}`) + "\n";
  }

  // ── Editing area ──
  if (editingField) {
    output += "\n";
    output += theme.accent(`  Editing ${editingField}: `) + editingValue;
    output += theme.muted(" (Enter to confirm, Esc to cancel)");
  }

  // ── Key hints ──
  output += "\n";
  output += theme.muted(
    "  ↑↓ nav  tab edit  i idea  e experiment  r run  s save  q quit" +
      (editingField ? "" : "")
  );

  process.stdout.write(output);
}

// ─── Keyboard Input ──────────────────────────────────────

if (!process.stdin.isTTY) {
  console.error("IST requires a terminal (TTY). Cannot run in a pipe or background.");
  process.exit(1);
}

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on("keypress", async (_str, key) => {
  // Handle editing mode
  if (editingField) {
    if (key.name === "return" || key.name === "enter") {
      if (editingField === "title") {
        updateSelectedTitle(state, editingValue);
      } else {
        updateSelectedDescription(state, editingValue);
      }
      editingField = null;
      editingValue = "";
      render();
      return;
    }
    if (key.name === "escape") {
      editingField = null;
      editingValue = "";
      render();
      return;
    }
    if (key.name === "backspace") {
      editingValue = editingValue.slice(0, -1);
      render();
      return;
    }
    if (key.sequence && key.sequence.length === 1) {
      editingValue += key.sequence;
      render();
      return;
    }
    return;
  }

  // Normal mode
  switch (key.name) {
    case "q":
      if (key.ctrl) break;
      // Quit
      if (state.isDirty) {
        state.error = "Unsaved changes. Press Ctrl+Q to force quit.";
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

    case "tab":
      if (state.selectedId) {
        const node = state.project.nodes[state.selectedId];
        if (node) {
          // Cycle: nothing → title → description → exit
          if (!editingField) {
            editingField = "title";
            editingValue = node.title;
          } else if (editingField === "title") {
            editingField = "description";
            editingValue = node.description;
          } else {
            editingField = null;
            editingValue = "";
          }
          render();
        }
      }
      break;

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
          render();
          await startExperiment(state, () => render());
          render();
        }
      }
      break;

    case "s":
      if (state.filePath) {
        save(state);
      } else {
        // Prompt for file path (simplified — just use a temp path)
        const defaultPath = "/tmp/ist-project.ist";
        state.error = `No file path. Saving to ${defaultPath}. Use CLI arg to specify path.`;
        saveAs(state, defaultPath);
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
      // Check for Ctrl+Q
      if (key.ctrl && key.name === "q") {
        cleanup();
      }
      break;
  }
});

function cleanup(): void {
  process.stdout.write("\x1b[?25h");
  process.stdout.write("\x1b[2J\x1b[H");
  process.exit(0);
}

// ─── Initial render ──────────────────────────────────────
render();
