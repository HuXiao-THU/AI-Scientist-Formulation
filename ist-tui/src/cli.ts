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
  const treeLines = renderTree(state.project, state.selectedId, W);
  const selNode = state.selectedId ? state.project.nodes[state.selectedId] ?? null : null;

  // Build fixed sections (bottom-up to determine remaining space)
  const footer: string[] = [];
  if (editingField) {
    footer.push(theme.muted("  Enter/Esc confirm  Tab switch field  Backspace delete"));
  } else {
    footer.push(theme.muted("  ↑↓ nav  i idea  e exp  r run  s save  Tab edit  del  q quit"));
  }

  if (editingField === "title") {
    const trimmed = editingValue.length > W - 20 ? editingValue.slice(-(W - 25)) + "…" : editingValue;
    footer.unshift(theme.accent(`  Editing title: `) + trimmed);
  } else if (editingField === "description") {
    footer.unshift(theme.accent("  Editing description" + theme.muted("  [Enter] newline  [Esc/Ctrl+Enter] finish  [Tab] switch")));
  }

  if (state.error) footer.unshift(theme.failed(`  ${state.error}`));

  // Middle section
  const middle: string[] = [];
  if (state.isRunning) {
    middle.push(theme.muted("─".repeat(W)));
    middle.push(...renderLogPanel(state.experimentLog, W));
  } else if (editingField === "description") {
    middle.push(theme.muted("─".repeat(W)));
    middle.push(theme.accent("  Description preview:"));
    const pv = editingValue.split("\n");
    for (const pl of pv.slice(-6)) middle.push(theme.accent("  │ ") + pl);
    for (let i = pv.length; i < 6; i++) middle.push(theme.accent("  │"));
  }

  // Detail (fixed 6 lines)
  const detail: string[] = [];
  const dl = renderNodeDetail(selNode, W, state.isRunning);
  for (let i = 0; i < DETAIL_LINES; i++) detail.push(dl[i] ?? "");

  // Calculate space for tree
  const fixedBelow = detail.length + 1 + middle.length + footer.length;
  const headerLines = 2;
  const maxTree = Math.max(5, R - 1 - headerLines - fixedBelow);

  // Collect all output lines into an array (no trailing \n on last line)
  const rows: string[] = [];

  // Status
  const label = state.filePath ?? "Untitled";
  const dirty = state.isDirty ? " *" : "";
  const modelTag = theme.muted(` [${state.experimentConfig.provider}/${state.experimentConfig.model}]`);
  const runningTag = state.isRunning ? theme.running(" ⏳ Running...") : "";
  rows.push(clipLine(`${theme.bold("IST")} ${theme.muted(label + dirty)}${modelTag}${runningTag}`, W));
  rows.push(theme.muted("─".repeat(W)));

  // Tree
  const visibleTree = treeLines.slice(0, maxTree);
  for (const line of visibleTree) rows.push(clipLine(line, W));
  while (rows.length < headerLines + maxTree) rows.push("");

  // Detail + middle + footer
  rows.push(theme.muted("─".repeat(W)));
  for (const line of detail) rows.push(clipLine(line, W));
  for (const line of middle) rows.push(clipLine(line, W));
  for (const line of footer) rows.push(clipLine(line, W));

  // Trim to R-1 lines (last row reserved for cursor to prevent scroll)
  const trimmed = rows.slice(0, R - 1);

  // Write: clear screen, then lines joined by \n (no trailing newline)
  process.stdout.write("\x1b[2J\x1b[H" + trimmed.join("\n"));
}

/** Clip a line to visual width, preserving ANSI codes */
function clipLine(s: string, maxW: number): string {
  let out = "";
  let vis = 0;
  for (let i = 0; i < s.length && vis < maxW; i++) {
    if (s[i] === "\x1b" && s.slice(i).match(/^\x1b\[[0-9;]*m/)) {
      const m = s.slice(i).match(/^\x1b\[[0-9;]*m/)!;
      out += m[0];
      i += m[0].length - 1;
      continue;
    }
    const cp = s.codePointAt(i) ?? 0;
    vis += (cp > 127 && cp < 0x20000) || cp >= 0x20000 ? 2 : 1;
    if (vis > maxW) break;
    out += s[i];
  }
  return out;
}

/** Truncate to visual width, preserving ANSI codes */
function truncateToVisualWidth(s: string, maxW: number): string {
  const ansi = /\x1b\[[0-9;]*m/g;
  let out = "";
  let visW = 0;
  let i = 0;
  while (i < s.length) {
    const rem = s.slice(i);
    const m = rem.match(ansi);
    if (m && m.index === 0) {
      out += m[0];
      i += m[0].length;
      continue;
    }
    const ch = s[i];
    const cp = ch.codePointAt(0) ?? 0;
    const cw = (cp >= 0x1100 && cp <= 0xffff && cp > 127) || cp >= 0x20000 ? 2 : 1;
    if (visW + cw > maxW) break;
    out += ch;
    visW += cw;
    i++;
  }
  return out;
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
        if (key.ctrl) {
          // Ctrl+Enter = confirm (useful for description)
          if (node) {
            if (editingField === "title") updateSelectedTitle(state, editingValue);
            else updateSelectedDescription(state, editingValue);
          }
          editingField = null; editingValue = ""; render(); return;
        }
        if (editingField === "description") {
          // Enter in description mode = insert newline
          editingValue += "\n";
          render(); return;
        }
        // Enter in title mode = confirm
        if (node) updateSelectedTitle(state, editingValue);
        editingField = null; editingValue = ""; render(); return;
      case "escape":
        // Escape = confirm and save (don't discard)
        if (node) {
          if (editingField === "title") updateSelectedTitle(state, editingValue);
          else updateSelectedDescription(state, editingValue);
        }
        editingField = null; editingValue = ""; render(); return;
      case "tab":
        if (editingField === "title" && node) {
          updateSelectedTitle(state, editingValue);
          editingField = "description"; editingValue = node.description;
        } else {
          if (node && editingField === "description") updateSelectedDescription(state, editingValue);
          editingField = null; editingValue = "";
        }
        render(); return;
      case "backspace":
        editingValue = editingValue.slice(0, -1);
        render(); return;
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
      if (key.ctrl) { cleanup(); return; }
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
      break;
  }
});

function cleanup(): void {
  process.stdout.write("\x1b[?25h\x1b[2J\x1b[H");
  process.exit(0);
}

render();
