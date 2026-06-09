#!/usr/bin/env node
import { loadEnv } from "./core/env.js";
loadEnv();

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
import { renderMarkdown } from "./tui/markdown-view.js";
import { theme } from "./tui/theme.js";
import { clipToWidth, charWidth } from "./utils/truncate.js";
import { fileExists } from "./core/ist-file.js";

// ─── Terminal Setup ──────────────────────────────────────

let W = process.stdout.columns || 120;
let R = process.stdout.rows || 40;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
process.stdout.on("resize", () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { W = process.stdout.columns || 120; R = process.stdout.rows || 40; render(); }, 50);
});
process.stdout.write("\x1b[?25l");
process.on("exit", () => process.stdout.write("\x1b[?25h\x1b[2J\x1b[H"));
if (!process.stdin.isTTY) { console.error("IST requires a terminal (TTY)."); process.exit(1); }

// ─── State ────────────────────────────────────────────────

let state: AppState = createAppState();
let editingField: "title" | "description" | null = null;
let editingValue = "";
let cursorPos = 0;
let viewMode: "tree" | "result" = "tree";
let resultScroll = 0;
let treeScroll = 0;
let descScroll = 0;

const args = process.argv.slice(2);
let cliFilePath: string | null = null;
if (args.length > 0) {
  const given = path.resolve(args[0]);
  if (fileExists(given)) { open(state, given); cliFilePath = given; }
  else if (args[0].endsWith(".ist")) { cliFilePath = given; }
}

// ─── Description Editor Helpers ───────────────────────────

/** Get (line index, col index) for a character position within text */
function getLineCol(text: string, pos: number): { line: number; col: number } {
  let line = 0, col = 0;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === "\n") { line++; col = 0; }
    else col++;
  }
  return { line, col };
}

/** Convert (line, col) back to character position */
function getPosFromLineCol(text: string, line: number, col: number): number {
  let ln = 0, ci = 0;
  for (let i = 0; i < text.length; i++) {
    if (ln === line) {
      if (ci >= col) return i;
      if (text[i] === "\n") return i;
      ci++;
    } else if (text[i] === "\n") {
      ln++;
    }
  }
  return text.length;
}

/** Wrap text to visual width, returning array of {text, startPos} for each display line */
function wrapLines(text: string, maxW: number): { text: string; startPos: number }[] {
  const result: { text: string; startPos: number }[] = [];
  const logicalLines = text.split("\n");
  let pos = 0;
  for (const ll of logicalLines) {
    const lineStart = pos;
    if (ll.length === 0) {
      result.push({ text: "", startPos: lineStart });
      pos += 1; // the \n
      continue;
    }
    let wrapped = "";
    let wrappedStart = lineStart;
    let visW = 0;
    for (let i = 0; i < ll.length; i++) {
      const ch = ll[i];
      const cp = ch.codePointAt(0) ?? 0;
      const cw = charWidth(cp);
      if (visW + cw > maxW && wrapped.length > 0) {
        result.push({ text: wrapped, startPos: wrappedStart });
        wrapped = "";
        wrappedStart = lineStart + i;
        visW = 0;
      }
      wrapped += ch;
      visW += cw;
    }
    if (wrapped.length > 0 || result.length === 0 || result[result.length - 1].text.length > 0) {
      result.push({ text: wrapped, startPos: wrappedStart });
    }
    pos += ll.length + 1; // +1 for \n
  }
  return result;
}

/** Find which display line and column the cursor is on */
function cursorDisplayPos(wrapped: { text: string; startPos: number }[], pos: number): { dispLine: number; dispCol: number } {
  for (let i = 0; i < wrapped.length; i++) {
    const w = wrapped[i];
    const endPos = w.startPos + w.text.length;
    if (pos >= w.startPos && pos < endPos) {
      return { dispLine: i, dispCol: pos - w.startPos };
    }
  }
  // Cursor at or past end: position after last character
  const last = wrapped[wrapped.length - 1];
  if (last) return { dispLine: wrapped.length - 1, dispCol: last.text.length };
  return { dispLine: 0, dispCol: 0 };
}

// ─── Render ──────────────────────────────────────────────

const DETAIL_LINES = 6;

function render(): void {
  // ── Result viewer mode ──
  if (viewMode === "result") {
    const selNode = state.selectedId ? state.project.nodes[state.selectedId] ?? null : null;
    const rows: string[] = [];
    rows.push(clipToWidth(`${theme.bold("IST")} ${theme.muted("— Result Viewer")}`, W));
    rows.push(theme.muted("─".repeat(W)));
    if (selNode) {
      rows.push(`  ${theme.bold("Experiment:")} ${selNode.title || "(untitled)"}`);
      const mdLines = renderMarkdown(selNode.experimentResult || "(no result)", W);
      const contentH = R - 1 - 3 - 2; // -header(3) -footer(2)
      const maxScroll = Math.max(0, mdLines.length - contentH);
      resultScroll = Math.max(0, Math.min(resultScroll, maxScroll));
      const visible = mdLines.slice(resultScroll, resultScroll + contentH);
      for (const l of visible) rows.push(clipToWidth(l, W));
      while (rows.length < 3 + contentH) rows.push("");
      if (maxScroll > 0) {
        const pct = Math.round((resultScroll / maxScroll) * 100);
        rows.push(theme.muted(`  ${resultScroll + 1}-${resultScroll + visible.length} / ${mdLines.length} lines (${pct}%)`));
      } else {
        rows.push("");
      }
    } else {
      rows.push(theme.muted("  No experiment selected."));
    }
    rows.push(theme.muted("  [↑↓] scroll  [Esc] back to tree  [q] quit"));
    process.stdout.write("\x1b[2J\x1b[H" + rows.slice(0, R - 1).join("\n"));
    return;
  }

  // ── Normal tree view ──
  const treeLines = renderTree(state.project, state.selectedId, W);
  const selNode = state.selectedId ? state.project.nodes[state.selectedId] ?? null : null;

  // Footer
  const footer: string[] = [];
  if (editingField) {
    if (editingField === "title") {
      footer.push(theme.accent(`  Editing title: `) + editingValue.slice(-(W - 25)));
    } else {
      const lc = getLineCol(editingValue, cursorPos);
      footer.push(theme.accent(`  Editing description | Line ${lc.line + 1}, Col ${lc.col + 1}`) +
        theme.muted("  [←→↑↓] move  [Esc] save  [Tab] switch"));
    }
  } else {
    footer.push(theme.muted("  ↑↓ nav  i idea  e exp  a summarize  r run  s save  Tab edit  del  q quit"));
    if (state.error) footer.unshift(theme.failed(`  ${state.error}`));
  }

  // Middle section (description editor or log)
  const middle: string[] = [];
  if (state.isRunning) {
    middle.push(theme.muted("─".repeat(W)));
    middle.push(...renderLogPanel(state.experimentLog, W, R));
  } else if (editingField === "description") {
    middle.push(theme.muted("─".repeat(W) + " Description " + "─".repeat(Math.max(0, W - 14))));
    const wrapW = W - 4;
    const wrapped = wrapLines(editingValue, wrapW);
    const cur = cursorDisplayPos(wrapped, cursorPos);

    // Limit visible lines and scroll
    const maxDescLines = Math.min(wrapped.length + 1, 10); // +1 for potential empty cursor line
    // Auto-scroll to keep cursor visible
    if (cur.dispLine < descScroll) descScroll = cur.dispLine;
    if (cur.dispLine >= descScroll + maxDescLines) descScroll = cur.dispLine - maxDescLines + 1;
    descScroll = Math.max(0, Math.min(descScroll, Math.max(0, wrapped.length + 1 - maxDescLines)));

    const endIdx = Math.min(descScroll + maxDescLines, wrapped.length);
    for (let i = descScroll; i < endIdx; i++) {
      let line = theme.accent("  │ ");
      if (i === cur.dispLine && cur.dispLine < wrapped.length) {
        const txt = wrapped[i].text;
        const col = Math.min(cur.dispCol, txt.length);
        const before = txt.slice(0, col);
        const at = txt[col] || " ";
        const after = txt.slice(col + 1);
        line += before + "\x1b[7m" + at + "\x1b[27m" + after;
      } else {
        line += wrapped[i].text;
      }
      middle.push(line);
    }
    // Show cursor on empty line if past end
    if (cur.dispLine >= wrapped.length && cur.dispLine >= descScroll && cur.dispLine < descScroll + maxDescLines) {
      middle.push(theme.accent("  │ ") + "\x1b[7m \x1b[27m");
    }
  }

  // Detail
  const detail: string[] = [];
  const dl = renderNodeDetail(selNode, W, state.isRunning);
  for (let i = 0; i < DETAIL_LINES; i++) detail.push(dl[i] ?? "");

  // Tree space
  const fixedBelow = detail.length + 1 + middle.length + footer.length;
  const maxTree = Math.max(5, R - 1 - 2 - fixedBelow);

  // Tree scroll: find selected node's line index and keep it visible
  const selIdx = state.selectedId
    ? treeLines.findIndex(l => l.includes(state.selectedId!))
    : -1;
  const clampedTreeScroll = Math.max(0, Math.min(treeScroll, Math.max(0, treeLines.length - maxTree)));
  // Auto-scroll: ensure selected node is in view
  if (selIdx >= 0) {
    if (selIdx < clampedTreeScroll) treeScroll = selIdx;
    else if (selIdx >= clampedTreeScroll + maxTree) treeScroll = selIdx - maxTree + 1;
  }
  const effTreeScroll = Math.max(0, Math.min(treeScroll, Math.max(0, treeLines.length - maxTree)));

  // Build rows
  const rows: string[] = [];
  const label = state.filePath ?? "Untitled";
  const dirty = state.isDirty ? " *" : "";
  const modelTag = theme.muted(` [${state.experimentConfig.provider}/${state.experimentConfig.model}]`);
  const runningTag = state.isRunning ? theme.running(" ⏳ Running...") : "";
  rows.push(clipToWidth(`${theme.bold("IST")} ${theme.muted(label + dirty)}${modelTag}${runningTag}`, W));
  rows.push(theme.muted("─".repeat(W)));

  const visibleTree = treeLines.slice(effTreeScroll, effTreeScroll + maxTree);
  for (const line of visibleTree) rows.push(clipToWidth(line, W));
  while (rows.length < 2 + maxTree) rows.push("");

  rows.push(theme.muted("─".repeat(W)));
  for (const line of detail) rows.push(clipToWidth(line, W));
  for (const line of middle) rows.push(clipToWidth(line, W));
  for (const line of footer) rows.push(clipToWidth(line, W));

  process.stdout.write("\x1b[2J\x1b[H" + rows.slice(0, R - 1).join("\n"));
}

// ─── Keyboard ─────────────────────────────────────────────

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on("keypress", async (_str, key) => {
  // ── Editing mode ──
  if (editingField) {
    const node = state.selectedId ? state.project.nodes[state.selectedId] : null;

    // Description: cursor-based editing
    if (editingField === "description") {
      switch (key.name) {
        case "escape":
          if (node) updateSelectedDescription(state, editingValue);
          editingField = null; editingValue = ""; cursorPos = 0; render(); return;
        case "tab":
          if (node) updateSelectedDescription(state, editingValue);
          editingField = "title"; editingValue = node?.title ?? ""; cursorPos = 0; descScroll = 0; render(); return;
        case "up": {
          const lc = getLineCol(editingValue, cursorPos);
          if (lc.line > 0) cursorPos = getPosFromLineCol(editingValue, lc.line - 1, lc.col);
          else cursorPos = 0;
          render(); return;
        }
        case "down": {
          const lc2 = getLineCol(editingValue, cursorPos);
          cursorPos = getPosFromLineCol(editingValue, lc2.line + 1, lc2.col);
          render(); return;
        }
        case "left":
          if (cursorPos > 0) { cursorPos--; render(); } return;
        case "right":
          if (cursorPos < editingValue.length) { cursorPos++; render(); } return;
        case "home":
          cursorPos = 0; render(); return;
        case "end":
          cursorPos = editingValue.length; render(); return;
        case "backspace":
          if (cursorPos > 0) {
            editingValue = editingValue.slice(0, cursorPos - 1) + editingValue.slice(cursorPos);
            cursorPos--;
            render();
          }
          return;
        case "delete":
          if (cursorPos < editingValue.length) {
            editingValue = editingValue.slice(0, cursorPos) + editingValue.slice(cursorPos + 1);
            render();
          }
          return;
        case "return":
        case "enter":
          editingValue = editingValue.slice(0, cursorPos) + "\n" + editingValue.slice(cursorPos);
          cursorPos++;
          render();
          return;
        default:
          if (key.sequence && key.sequence.length === 1 && key.sequence >= " ") {
            editingValue = editingValue.slice(0, cursorPos) + key.sequence + editingValue.slice(cursorPos);
            cursorPos++;
            render();
          }
          return;
      }
    }

    // Title: simple single-line editing
    if (editingField === "title") {
      switch (key.name) {
        case "return":
        case "enter":
          if (node) updateSelectedTitle(state, editingValue);
          editingField = null; editingValue = ""; render(); return;
        case "escape":
          if (node) updateSelectedTitle(state, editingValue);
          editingField = null; editingValue = ""; render(); return;
        case "tab":
          if (node) { updateSelectedTitle(state, editingValue); editingField = "description"; editingValue = node.description; cursorPos = node.description.length; }
          else { editingField = null; editingValue = ""; cursorPos = 0; }
          render(); return;
        case "backspace":
          editingValue = editingValue.slice(0, -1); render(); return;
        default:
          if (key.sequence && key.sequence.length === 1 && key.sequence >= " ") {
            editingValue += key.sequence; render();
          }
          return;
      }
    }
  }

  // ── Normal mode ──
  if (viewMode === "result") {
    switch (key.name) {
      case "up":    resultScroll = Math.max(0, resultScroll - 1); render(); return;
      case "down":  resultScroll++; render(); return;
      case "escape": viewMode = "tree"; resultScroll = 0; render(); return;
      case "q":
        if (key.ctrl) { cleanup(); return; }
        cleanup(); return;
    }
    return;
  }

  switch (key.name) {
    case "q": {
      if (key.ctrl) { cleanup(); return; }
      if (state.isDirty) { state.error = "Unsaved changes. Ctrl+Q to force quit."; render(); }
      else cleanup();
      break;
    }
    case "up":    navigateUp(state); render(); break;
    case "down":  navigateDown(state); render(); break;
    case "tab": {
      if (!state.selectedId || state.isRunning) break;
      const n = state.project.nodes[state.selectedId];
      if (n) { editingField = "title"; editingValue = n.title; cursorPos = n.title.length; render(); }
      break;
    }
    case "i":
      if (!state.isRunning) { addChildNode(state, "idea"); render(); } break;
    case "e":
      if (!state.isRunning) { addChildNode(state, "experiment"); render(); } break;
    case "r":
      if (!state.isRunning && state.selectedId) {
        const n = state.project.nodes[state.selectedId];
        if (n?.type === "experiment") { state.error = null; render(); await startExperiment(state, () => render()); render(); }
        else { state.error = "Select an experiment node to run."; render(); }
      }
      break;
    case "s":
      if (key.ctrl) break;
      if (state.filePath) { save(state); }
      else { const p = cliFilePath ?? path.join(process.cwd(), "project.ist"); saveAs(state, p); cliFilePath = p; state.error = `Saved to ${p}`; }
      render();
      break;
    case "delete":
    case "backspace":
      if (!state.isRunning && state.selectedId) {
        const n = state.project.nodes[state.selectedId];
        if (n && state.selectedId !== state.project.rootNodeId) { deleteSelected(state); render(); }
      }
      break;
    case "escape":
      selectNode(state, null); render();
      break;
    case "a":
      if (!state.isRunning && state.selectedId) {
        const an = state.project.nodes[state.selectedId];
        if (an?.type === "idea") {
          const { aiSummarize } = await import("./app.js");
          render();
          await aiSummarize(state, () => render());
          render();
        }
      }
      break;
    case "m":
      if (!state.isRunning && state.selectedId) {
        const rn = state.project.nodes[state.selectedId];
        if (rn?.type === "experiment" && rn.experimentResult) {
          viewMode = "result"; resultScroll = 0; render();
        }
      }
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
