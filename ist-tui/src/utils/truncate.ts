export function truncateText(text: string, maxLen = 2000): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

export function safeErrorMessage(err: unknown, maxLen = 500): string {
  const raw =
    err instanceof Error ? err.message || err.name
    : typeof err === "string" ? err
    : "Unknown error";
  return truncateText(raw, maxLen);
}

/** Strip ANSI SGR escape sequences */
const ANSI_RE = /\x1b\[[0-9;]*m/g;
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/** Visual display width: ASCII = 1, CJK = 2 */
export function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    w += charWidth(cp) ? 2 : 1;
  }
  return w;
}

/** Single character display width: 1 for narrow, 2 for wide */
export function charWidth(cp: number): number {
  if (cp <= 127) return 1;                     // ASCII
  if (cp <= 0x024f) return 1;                  // Latin extensions
  if (cp >= 0x20000 && cp <= 0x2ffff) return 2; // CJK Ext B+
  if (cp >= 0x1100 && cp <= 0x115f) return 2;   // Hangul Jamo
  if (cp >= 0x2e80 && cp <= 0xa4cf) return 2;   // CJK
  if (cp >= 0xac00 && cp <= 0xd7a3) return 2;   // Hangul Syllables
  if (cp >= 0xf900 && cp <= 0xfaff) return 2;   // CJK Compat
  if (cp >= 0xff01 && cp <= 0xff60) return 2;   // Fullwidth
  if (cp >= 0xffe0 && cp <= 0xffe6) return 2;
  if (cp >= 0x1f300 && cp <= 0x1f6ff) return 2; // Emoji/Transport
  if (cp >= 0x2500 && cp <= 0x257f) return 1;   // Box-drawing
  if (cp >= 0x2580 && cp <= 0x259f) return 1;   // Block elements
  if (cp >= 0x25a0 && cp <= 0x25ff) return 1;   // Geometric shapes (●○◉✓✗)
  if (cp >= 0x2600 && cp <= 0x26ff) return 1;   // Misc symbols
  if (cp >= 0x2700 && cp <= 0x27bf) return 1;   // Dingbats
  return 1;                                      // Default narrow
}

/** Truncate to fit within visual terminal width */
export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) return "";
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const cw = charWidth(text.codePointAt(i) ?? 0) ? 2 : 1;
    if (w + cw > width) return text.slice(0, i);
    w += cw;
  }
  return text;
}

/** Pad string to target visual width with trailing spaces */
export function padToWidth(s: string, targetWidth: number): string {
  const clean = stripAnsi(s);
  const vw = visualWidth(clean);
  if (vw >= targetWidth) return s;
  return s + " ".repeat(targetWidth - vw);
}

/** Clip a line to a maximum visual width, preserving ANSI codes */
export function clipToWidth(s: string, maxW: number): string {
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
    vis += charWidth(cp);
    if (vis > maxW) break;
    out += s[i];
  }
  return out;
}
