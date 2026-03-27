/**
 * Formatting utilities for the trace viewer.
 */

/** Format a duration in milliseconds to a human-readable string. */
export function formatDuration(ms: number): string {
  if (ms < 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Format a USD cost value. */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/** Format a token count with commas or abbreviation. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

/** Format a Date to a human-readable string. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Produce an HTML string with syntax-highlighted JSON.
 * Manually tokenized — no external library.
 */
export function syntaxHighlightJson(obj: unknown): string {
  if (obj === undefined) return '<span class="json-null">undefined</span>';

  let json: string;
  try {
    json = JSON.stringify(obj, null, 2);
  } catch {
    return `<span class="json-string">[Unserializable]</span>`;
  }

  if (json === undefined) {
    return '<span class="json-null">undefined</span>';
  }

  return json.replace(
    /("(?:\\.|[^"\\])*")\s*(:)?|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\]])|([,:])/g,
    (
      match: string,
      str?: string,
      colon?: string,
      bool?: string,
      nil?: string,
      num?: string,
      bracket?: string,
      punct?: string,
    ) => {
      if (str) {
        if (colon) {
          return `<span class="json-key">${escapeHtml(str)}</span><span class="json-punctuation">:</span>`;
        }
        return `<span class="json-string">${escapeHtml(str)}</span>`;
      }
      if (bool) return `<span class="json-boolean">${match}</span>`;
      if (nil) return `<span class="json-null">${match}</span>`;
      if (num) return `<span class="json-number">${match}</span>`;
      if (bracket) return `<span class="json-bracket">${match}</span>`;
      if (punct) return `<span class="json-punctuation">${match}</span>`;
      return match;
    },
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
