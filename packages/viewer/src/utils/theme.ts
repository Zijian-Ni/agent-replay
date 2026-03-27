/**
 * Theme management — dark mode by default, uses CSS custom properties.
 */

type Theme = "dark" | "light";

const STORAGE_KEY = "agent-replay-theme";

function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

/** Initialize theme from stored preference or system default. */
export function initTheme(): void {
  applyTheme(getPreferredTheme());
}

/** Toggle between dark and light themes. Returns the new theme. */
export function toggleTheme(): Theme {
  const current = document.documentElement.getAttribute("data-theme") as Theme;
  const next: Theme = current === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
