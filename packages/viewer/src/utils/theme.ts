/**
 * Theme management — dark mode by default, uses CSS custom properties.
 * Supports smooth transitions between themes.
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

function applyTheme(theme: Theme, animate = false): void {
  if (animate) {
    // Enable smooth color transition
    document.documentElement.classList.add("theme-transitioning");
    // Remove class after transition completes
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 450);
  }
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

/** Initialize theme from stored preference or system default. */
export function initTheme(): void {
  applyTheme(getPreferredTheme(), false);
}

/** Toggle between dark and light themes. Returns the new theme. */
export function toggleTheme(): Theme {
  const current = document.documentElement.getAttribute("data-theme") as Theme;
  const next: Theme = current === "dark" ? "light" : "dark";
  applyTheme(next, true);
  return next;
}
