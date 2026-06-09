/**
 * Simple terminal markdown renderer.
 * Renders headings, bold, italic, code blocks, and lists.
 */
import { theme } from "./theme.js";
import { clipToWidth } from "../utils/truncate.js";

export function renderMarkdown(md: string, width: number): string[] {
  const lines: string[] = [];
  const rawLines = md.split("\n");
  let inCodeBlock = false;

  for (const raw of rawLines) {
    // Code block fences
    if (raw.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) lines.push(theme.muted("  ┌─ code ─".padEnd(width - 2, "─")));
      else lines.push(theme.muted("  └" + "─".repeat(width - 4)));
      continue;
    }

    if (inCodeBlock) {
      lines.push(theme.muted("  │ ") + theme.dim(raw.slice(0, width - 6)));
      continue;
    }

    // Headings
    if (/^#{1,3}\s/.test(raw)) {
      const m = raw.match(/^(#{1,3})\s+(.*)/);
      if (m) {
        const level = m[1].length;
        const text = m[2];
        const styled = level === 1 ? theme.bold(theme.accent(text))
          : level === 2 ? theme.bold(text)
          : theme.italic(text);
        lines.push("  " + styled);
        continue;
      }
    }

    // Horizontal rule
    if (/^-{3,}$/.test(raw.trim())) {
      lines.push(theme.muted("  " + "─".repeat(width - 4)));
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*]\s/.test(raw)) {
      const text = raw.replace(/^[\s]*[-*]\s/, "");
      lines.push(renderInline("    • " + text, width));
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+[.)]\s/.test(raw)) {
      const text = raw.replace(/^[\s]*\d+[.)]\s/, "");
      lines.push(renderInline("    • " + text, width));
      continue;
    }

    // Empty line
    if (raw.trim() === "") {
      lines.push("");
      continue;
    }

    // Regular paragraph
    lines.push(renderInline("  " + raw, width));
  }

  return lines;
}

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string, maxW: number): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    // **bold**
    if (text.slice(i).startsWith("**")) {
      const end = text.indexOf("**", i + 2);
      if (end > i) {
        out += theme.bold(text.slice(i + 2, end));
        i = end + 2;
        continue;
      }
    }
    // *italic*
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i) {
        out += theme.italic(text.slice(i + 1, end));
        i = end + 1;
        continue;
      }
    }
    // `code`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        out += theme.accent(text.slice(i + 1, end));
        i = end + 1;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return clipToWidth(out, maxW);
}
