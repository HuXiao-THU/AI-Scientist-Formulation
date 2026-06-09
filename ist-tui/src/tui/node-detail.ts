import type { ISTNode } from "../core/types.js";
import { theme } from "./theme.js";
import { truncateToWidth } from "../utils/truncate.js";

/** Render the node detail panel */
export function renderNodeDetail(
  node: ISTNode | null,
  width: number,
  isRunning: boolean
): string[] {
  if (!node) {
    return renderBox("Node Details", ["No node selected."], width);
  }

  const typeLabel = node.type === "idea" ? "Idea" : "Experiment";
  const typeColor = node.type === "idea" ? theme.idea : theme.experiment;

  // Status line for experiments
  let statusLine = "";
  if (node.type === "experiment") {
    const status = node.runStatus || "idle";
    const statusColors: Record<string, (s: string) => string> = {
      running: theme.running,
      done: theme.done,
      failed: theme.failed,
      idle: theme.idle,
    };
    statusLine = `  Status: ${statusColors[status]?.(status) ?? status}`;
  }

  // Branch info
  const branchLine = node.gitBranch ? `  Branch: ${node.gitBranch}` : "";

  // Build content lines
  const content: string[] = [];
  content.push(`  Type: ${typeColor(typeLabel)}`);

  if (statusLine) content.push(statusLine);
  if (branchLine) content.push(branchLine);

  content.push("");
  content.push(`  ${theme.bold("Title:")}`);
  content.push(`  ${node.title || theme.muted("(untitled)")}`);
  content.push("");
  content.push(`  ${theme.bold("Description:")}`);

  // Word-wrap the description
  const desc = node.description || theme.muted("(no description)");
  const wrapWidth = Math.max(20, width - 4);
  const words = desc.split(/\s+/);
  let line = "  ";
  for (const word of words) {
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, "");
    if (cleanLine.length + word.length + 1 > wrapWidth) {
      content.push(line);
      line = "  " + word;
    } else {
      line += (line.length > 2 ? " " : "") + word;
    }
  }
  if (line.length > 2) content.push(line);

  // Result for experiments
  if (node.type === "experiment" && node.experimentResult) {
    content.push("");
    content.push(`  ${theme.bold("Result:")}`);
    const result = truncateToWidth(node.experimentResult, wrapWidth * 3);
    for (const rline of result.split("\n").slice(0, 6)) {
      content.push(`  ${theme.muted(rline)}`);
    }
  }

  // Footer with keybindings
  content.push("");
  if (isRunning) {
    content.push(theme.accent("  [s] Stop Experiment"));
  } else if (node.type === "experiment") {
    content.push(theme.accent("  [r] Run Experiment"));
  }
  if (node.type === "idea") {
    content.push(theme.accent("  [i] Add Idea    [e] Add Experiment"));
  }
  content.push(
    theme.accent(
      `  [tab] Edit Title/Desc  [del] Delete${node.type === "idea" ? "  [a] AI Summarize" : ""}`
    )
  );

  return renderBox(`Node Details — ${typeLabel}`, content, width);
}

/** Draw a simple bordered box */
export function renderBox(
  title: string,
  content: string[],
  width: number
): string[] {
  const lines: string[] = [];
  const w = Math.max(20, width);
  const hBar = "─".repeat(Math.max(0, w - 2));

  lines.push(theme.border(`┌${hBar}┐`));
  // Title bar
  const titleClean = title.replace(/\x1b\[[0-9;]*m/g, "");
  const padRight = Math.max(0, w - 2 - titleClean.length);
  lines.push(theme.border(`│`) + theme.bold(title) + " ".repeat(padRight) + theme.border(`│`));
  lines.push(theme.border(`├${hBar}┤`));

  for (const c of content) {
    const clean = c.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = Math.max(0, w - 2 - clean.length);
    lines.push(theme.border(`│`) + c + " ".repeat(pad) + theme.border(`│`));
  }

  lines.push(theme.border(`└${hBar}┘`));
  return lines;
}
