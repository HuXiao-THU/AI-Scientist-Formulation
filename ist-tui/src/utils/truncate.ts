export function truncateText(text: string, maxLen = 2000): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

export function safeErrorMessage(err: unknown, maxLen = 500): string {
  const raw =
    err instanceof Error
      ? err.message || err.name
      : typeof err === "string"
        ? err
        : "Unknown error";
  return truncateText(raw, maxLen);
}

/** Truncate to fit within terminal width, accounting for double-width chars */
export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) return "";
  let displayed = 0;
  for (let i = 0; i < text.length; i++) {
    const charWidth = text.charCodeAt(i) > 127 ? 2 : 1;
    if (displayed + charWidth > width) return text.slice(0, i);
    displayed += charWidth;
  }
  return text;
}
