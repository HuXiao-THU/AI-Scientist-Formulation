import type { ExperimentLogEvent } from "../core/types.js";
import { theme } from "./theme.js";
import { truncateToWidth } from "../utils/truncate.js";

/** Store for the streaming experiment log */
export class ExperimentLog {
  private entries: ExperimentLogEvent[] = [];
  private maxEntries = 500;

  append(event: ExperimentLogEvent): void {
    // Skip exact duplicate consecutive messages
    const last = this.entries[this.entries.length - 1];
    if (last && last.type === event.type && last.message === event.message) return;
    this.entries.push(event);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  clear(): void { this.entries = []; }

  getEntries(): ExperimentLogEvent[] { return this.entries; }

  isEmpty(): boolean { return this.entries.length === 0; }
}

/** Render the experiment log panel */
export function renderLogPanel(
  log: ExperimentLog,
  width: number
): string[] {
  const entries = log.getEntries();
  if (entries.length === 0) {
    return renderBox("Experiment Log", [theme.muted("  No experiment running.")], width);
  }

  const maxLines = Math.max(5, process.stdout.rows - 20);
  const displayEntries = entries.slice(-maxLines);

  const content: string[] = [];
  for (const entry of displayEntries) {
    const icon =
      entry.type === "tool_start" ? theme.accent("  🔧")
      : entry.type === "tool_end" ? theme.done("  ✓")
      : entry.type === "assistant" ? theme.fg.blue("  💬")
      : entry.type === "error" ? theme.failed("  ✗")
      : theme.done("  🏁");

    const text = truncateToWidth(entry.message, width - 8);
    content.push(`${icon} ${text}`);
  }

  return renderBox("Experiment Log", content, width);
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
  const titleLen = title.replace(/\x1b\[[0-9;]*m/g, "").length;
  lines.push(theme.border("│") + theme.bold(title) + " ".repeat(Math.max(0, w - 2 - titleLen)) + theme.border("│"));
  lines.push(theme.border(`├${hBar}┤`));

  for (const c of content) {
    const cl = c.replace(/\x1b\[[0-9;]*m/g, "").length;
    lines.push(theme.border("│") + c + " ".repeat(Math.max(0, w - 2 - cl)) + theme.border("│"));
  }

  lines.push(theme.border(`└${hBar}┘`));
  return lines;
}
