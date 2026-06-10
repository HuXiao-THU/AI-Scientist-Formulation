/**
 * Terminal markdown renderer with auto word-wrap.
 * Renders headings, bold, italic, code, code blocks, lists, and paragraphs.
 */
import { theme } from "./theme.js";
import { stripAnsi, visualWidth, clipToWidth } from "../utils/truncate.js";

const WRAP_MARGIN = 4; // left indent for content

export function renderMarkdown(md: string, width: number): string[] {
  const lines: string[] = [];
  const rawLines = md.split("\n");
  let inCodeBlock = false;
  const maxW = width - WRAP_MARGIN;

  for (const raw of rawLines) {
    // Code block fences
    if (raw.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        lines.push(theme.muted("  ┌─ code " + "─".repeat(Math.max(0, width - 12))));
      } else {
        lines.push(theme.muted("  └" + "─".repeat(Math.max(0, width - 4))));
      }
      continue;
    }

    if (inCodeBlock) {
      // Code lines: no wrap, clip to width
      lines.push(theme.muted("  │ ") + theme.dim(clipToWidth(raw, maxW - 2)));
      continue;
    }

    // Headings
    if (/^#{1,3}\s/.test(raw)) {
      const m = raw.match(/^(#{1,3})\s+(.*)/);
      if (m) {
        const level = m[1].length;
        const text = renderStyled(m[2]);
        const styled = level === 1 ? theme.bold(theme.accent(text))
          : level === 2 ? theme.bold(text)
          : theme.italic(text);
        for (const l of wrapStyled(styled, maxW, "")) {
          lines.push(l);
        }
        continue;
      }
    }

    // Horizontal rule
    if (/^-{3,}$/.test(raw.trim())) {
      lines.push(theme.muted("  " + "─".repeat(Math.max(0, width - 4))));
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*]\s/.test(raw)) {
      const text = raw.replace(/^[\s]*[-*]\s/, "");
      const rendered = renderStyled(text);
      for (const l of wrapStyled(rendered, maxW, "    • ")) {
        lines.push(l);
      }
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+[.)]\s/.test(raw)) {
      const text = raw.replace(/^[\s]*\d+[.)]\s/, "");
      const rendered = renderStyled(text);
      for (const l of wrapStyled(rendered, maxW, "    • ")) {
        lines.push(l);
      }
      continue;
    }

    // Empty line
    if (raw.trim() === "") {
      lines.push("");
      continue;
    }

    // Regular paragraph
    const rendered = renderStyled(raw);
    for (const l of wrapStyled(rendered, maxW, "  ")) {
      lines.push(l);
    }
  }

  return lines;
}

/** Render inline markdown: **bold**, *italic*, `code` */
function renderStyled(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.slice(i).startsWith("**")) {
      const end = text.indexOf("**", i + 2);
      if (end > i) { out += theme.bold(text.slice(i + 2, end)); i = end + 2; continue; }
    }
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i) { out += theme.italic(text.slice(i + 1, end)); i = end + 1; continue; }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) { out += theme.accent(text.slice(i + 1, end)); i = end + 1; continue; }
    }
    out += text[i];
    i++;
  }
  return out;
}

/**
 * Word-wrap a string that may contain ANSI codes.
 * Splits on spaces, builds lines tracking visual width.
 */
function wrapStyled(text: string, maxW: number, indent: string): string[] {
  const result: string[] = [];
  // Split into tokens: words + spaces (preserving ANSI codes)
  const tokens = splitTokens(text);
  let line = indent;
  let lineVW = visualWidth(stripAnsi(indent));

  for (const token of tokens) {
    const tokenClean = stripAnsi(token);
    const tokenVW = visualWidth(tokenClean);

    // If a single token is wider than maxW, we must force-break it
    if (tokenVW > maxW && lineVW === visualWidth(stripAnsi(indent))) {
      // Force-break the token across multiple lines
      let remaining = token;
      while (stripAnsi(remaining).length > 0) {
        const available = maxW - lineVW;
        if (available <= 0) {
          result.push(line);
          line = indent;
          lineVW = visualWidth(stripAnsi(indent));
        }
        const chunk = clipToWidth(remaining, Math.max(1, maxW - lineVW));
        line += chunk;
        lineVW += visualWidth(stripAnsi(chunk));
        remaining = remaining.slice(chunk.length);
        if (stripAnsi(remaining).length > 0) {
          result.push(line);
          line = indent;
          lineVW = visualWidth(stripAnsi(indent));
        }
      }
      continue;
    }

    // Check if space is a word separator (actual space, not leading spaces)
    const isSpace = tokenClean.trim() === "";

    if (isSpace) {
      // Skip leading spaces on continuation lines
      if (lineVW === visualWidth(stripAnsi(indent))) continue;
      if (lineVW + tokenVW <= maxW) {
        line += token;
        lineVW += tokenVW;
      }
      continue;
    }

    // Word token: check if it fits
    if (lineVW + tokenVW <= maxW) {
      line += token;
      lineVW += tokenVW;
    } else {
      // New line needed
      if (lineVW > visualWidth(stripAnsi(indent))) {
        result.push(line);
      }
      line = indent + token;
      lineVW = visualWidth(stripAnsi(indent)) + tokenVW;
    }
  }

  if (line.length > indent.length || result.length === 0) {
    result.push(line);
  }

  return result;
}

/** Split a styled string into word/space tokens, preserving ANSI codes */
function splitTokens(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    // Preserve ANSI sequences
    if (text[i] === "\x1b" && text.slice(i).match(/^\x1b\[[0-9;]*m/)) {
      const m = text.slice(i).match(/^\x1b\[[0-9;]*m/)!;
      current += m[0];
      i += m[0].length - 1;
      continue;
    }
    if (text[i] === " ") {
      if (current) tokens.push(current);
      current = "";
      tokens.push(" "); // space as separate token
    } else {
      current += text[i];
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
