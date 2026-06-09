/** Avoid Node/Electron crashes when very long strings flow into Error/IPC paths. */
export function truncateText(text: string, maxLen = 2000): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}… [truncated, ${text.length} chars total]`
}

export function safeErrorMessage(err: unknown, maxLen = 500): string {
  const raw =
    err instanceof Error
      ? err.message || err.name
      : typeof err === 'string'
        ? err
        : 'Unknown error'
  return truncateText(raw, maxLen)
}
