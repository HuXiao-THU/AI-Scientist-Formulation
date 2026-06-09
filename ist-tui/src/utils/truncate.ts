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
    w += isWideChar(cp) ? 2 : 1;
  }
  return w;
}

function isWideChar(cp: number): boolean {
  return (cp >= 0x1100 && cp <= 0x115f) ||  // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) ||        // CJK Radicals .. Yi
    (cp >= 0xac00 && cp <= 0xd7a3) ||        // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) ||        // CJK Compatibility
    (cp >= 0xff01 && cp <= 0xff60) ||        // Fullwidth Forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||      // Emoticons
    (cp >= 0x1f680 && cp <= 0x1f6ff) ||      // Transport
    (cp >= 0x20000 && cp <= 0x2ffff);        // CJK Ext B+
}

/** Truncate to fit within visual terminal width */
export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) return "";
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const cw = isWideChar(text.codePointAt(i) ?? 0) ? 2 : 1;
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
