import type { ExperimentLogEvent } from "../core/types.js";
import { theme } from "./theme.js";
import { truncateToWidth } from "../utils/truncate.js";
import { renderBox } from "./node-detail.js";

/** Store for the streaming experiment log */
export class ExperimentLog {
  private entries: ExperimentLogEvent[] = [];
  private maxEntries = 500;

  append(event: ExperimentLogEvent): void {
    this.entries.push(event);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  clear(): void {
    this.entries = [];
  }

  getEntries(): ExperimentLogEvent[] {
    return this.entries;
  }

  isEmpty(): boolean {
    return this.entries.length === 0;
  }
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

  // Show last N entries that fit
  const maxLines = Math.max(5, process.stdout.rows - 20);
  const displayEntries = entries.slice(-maxLines);

  const content: string[] = [];
  for (const entry of displayEntries) {
    const icon =
      entry.type === "tool_start"
        ? theme.accent("  🔧")
        : entry.type === "tool_end"
          ? theme.done("  ✓")
          : entry.type === "assistant"
            ? theme.fg.blue("  💬")
            : entry.type === "error"
              ? theme.failed("  ✗")
              : theme.done("  🏁");

    const text = truncateToWidth(entry.message, width - 8);
    content.push(`${icon} ${text}`);
  }

  return renderBox("Experiment Log", content, width);
}
