/**
 * Keyboard shortcuts help panel — press ? to toggle.
 */

const SHORTCUTS = [
  { key: "j / ↓", description: "Next step" },
  { key: "k / ↑", description: "Previous step" },
  { key: "Enter", description: "Select / expand step" },
  { key: "Ctrl+K", description: "Open search" },
  { key: "Esc", description: "Close panel / search" },
  { key: "?", description: "Toggle this help" },
  { key: "t", description: "Toggle theme" },
  { key: "f", description: "Toggle flame graph" },
  { key: "h", description: "Toggle heatmap" },
  { key: "1", description: "Timeline view" },
  { key: "2", description: "Flame graph view" },
  { key: "3", description: "Heatmap view" },
];

let panelEl: HTMLElement | null = null;
let isVisible = false;

function createPanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "shortcuts-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Keyboard shortcuts");
  panel.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    animation: overlay-in 150ms ease;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    background: var(--color-surface, #1c2128);
    border: 1px solid var(--color-border, #30363d);
    border-radius: 12px;
    padding: 24px 32px;
    min-width: 320px;
    max-width: 420px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  `;

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;font-size:16px;font-weight:600;color:var(--color-text,#c9d1d9);">Keyboard Shortcuts</h3>
      <kbd style="font-size:11px;padding:2px 6px;background:var(--color-bg,#0d1117);border:1px solid var(--color-border,#30363d);border-radius:4px;color:var(--color-text-muted,#8b949e);">?</kbd>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${SHORTCUTS.map((s) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <span style="font-size:13px;color:var(--color-text-muted,#8b949e);">${s.description}</span>
          <kbd style="font-size:12px;padding:2px 8px;background:var(--color-bg,#0d1117);border:1px solid var(--color-border,#30363d);border-radius:4px;color:var(--color-text,#c9d1d9);white-space:nowrap;">${s.key}</kbd>
        </div>
      `).join("")}
    </div>
  `;

  panel.appendChild(card);

  // Click outside to close
  panel.addEventListener("click", (e) => {
    if (e.target === panel) hideShortcutsPanel();
  });

  return panel;
}

export function toggleShortcutsPanel(): void {
  if (isVisible) {
    hideShortcutsPanel();
  } else {
    showShortcutsPanel();
  }
}

export function showShortcutsPanel(): void {
  if (isVisible) return;
  if (!panelEl) panelEl = createPanel();
  document.body.appendChild(panelEl);
  isVisible = true;
}

export function hideShortcutsPanel(): void {
  if (!isVisible || !panelEl) return;
  panelEl.remove();
  isVisible = false;
}

export function isShortcutsPanelVisible(): boolean {
  return isVisible;
}
