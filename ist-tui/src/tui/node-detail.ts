import type { ISTNode } from "../core/types.js";
import { theme } from "./theme.js";
import { truncateToWidth } from "../utils/truncate.js";

/** Render compact selected-node detail (fits in ~4-6 lines, no border box). */
export function renderNodeDetail(
  node: ISTNode | null,
  width: number,
  isRunning: boolean
): string[] {
  const lines: string[] = [];
  const maxW = Math.max(40, width - 2);

  if (!node) {
    lines.push(theme.muted("  No node selected."));
    while (lines.length < 6) lines.push("");
    return lines;
  }

  const typeLabel = node.type === "idea" ? "Idea" : "Experiment";
  const typeColor = node.type === "idea" ? theme.badge.idea : theme.badge.experiment;

  // Line 1: type + status + branch
  let line1 = `  ${typeColor(`[${typeLabel}]`)}`;
  if (node.type === "experiment") {
    const s = node.runStatus || "idle";
    const sc: Record<string, (s: string) => string> = {
      running: theme.running,
      done: theme.done,
      failed: theme.failed,
      idle: theme.idle,
    };
    line1 += `  Status: ${sc[s]?.(s) ?? s}`;
  }
  if (node.gitBranch) line1 += `  Branch: ${theme.muted(node.gitBranch)}`;
  lines.push(truncateToWidth(line1, maxW));

  // Line 2: title
  const title = node.title || theme.muted("(untitled)");
  lines.push(`  ${theme.bold("Title:")} ${title}`);

  // Line 3-5: description (wrapped)
  const desc = node.description || theme.muted("(no description)");
  const descWrapped = wrapText(desc, maxW - 2, "    ");
  for (const dl of descWrapped.slice(0, 3)) {
    lines.push(dl);
  }

  // If experiment and has result, show summary
  if (node.type === "experiment" && node.experimentResult) {
    const result = truncateToWidth(node.experimentResult, maxW - 10);
    lines.push(`  ${theme.bold("Result:")} ${theme.muted(result)}`);
  }

  // Fill to consistent height
  while (lines.length < 6) lines.push("");

  return lines;
}

/** Simple word-wrap preserving ANSI codes */
function wrapText(text: string, maxWidth: number, indent: string): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let line = indent;
  for (const word of words) {
    const cleanLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
    if (cleanLen + word.length + 1 > maxWidth && cleanLen > indent.length) {
      lines.push(line);
      line = indent + word;
    } else {
      line += (line.length > indent.length ? " " : "") + word;
    }
  }
  if (line.length > indent.length) lines.push(line);
  if (lines.length === 0) lines.push(indent + text);
  return lines;
}

