import type { ISTNode } from "../core/types.js";
import { theme } from "./theme.js";
import { truncateToWidth, stripAnsi, visualWidth } from "../utils/truncate.js";

/** Render compact selected-node detail (always exactly 6 lines). */
export function renderNodeDetail(
  node: ISTNode | null,
  width: number,
  _isRunning: boolean
): string[] {
  const maxW = Math.max(40, width - 2);

  if (!node) {
    const lines: string[] = [theme.muted("  No node selected.")];
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
      running: theme.running, done: theme.done, failed: theme.failed, idle: theme.idle,
    };
    line1 += `  Status: ${sc[s]?.(s) ?? s}`;
  }
  if (node.gitBranch) line1 += `  Branch: ${theme.muted(node.gitBranch)}`;
  const lines: string[] = [truncateToWidth(line1, maxW)];

  // Line 2: title
  let title = node.title || theme.muted("(untitled)");
  // Truncate to one visual line
  title = truncateToWidth(stripAnsi(title), maxW);
  lines.push(`  ${theme.bold("Title:")} ${title}`);

  // Remaining lines: description or result summary
  const desc = node.description || theme.muted("(no description)");
  const descFirstLine = desc.split("\n")[0];
  const shortDesc = truncateToWidth(descFirstLine, maxW - 2);
  lines.push(`    ${shortDesc}`);

  // If experiment with result, show one-line result hint
  if (node.type === "experiment" && node.experimentResult) {
    const firstLine = node.experimentResult.split("\n")[0];
    lines.push(`  ${theme.bold("Result:")} ${theme.muted(truncateToWidth(firstLine, maxW - 10))}`);
    lines.push(theme.accent(`  [m] View full result (${node.experimentResult.length} chars)`));
  } else if (node.type === "experiment") {
    lines.push(theme.muted("  No result yet."));
  }

  // Pad to exactly 6 lines
  while (lines.length < 6) lines.push("");
  return lines.slice(0, 6);
}
