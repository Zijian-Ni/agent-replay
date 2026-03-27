/**
 * Keyboard shortcuts help panel — press ? to toggle.
 * Glass-morphism modal with smooth animations.
 */

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "j / ↓", description: "Next step" },
      { key: "k / ↑", description: "Previous step" },
      { key: "Enter", description: "Select / expand step" },
    ],
  },
  {
    title: "Views",
    shortcuts: [
      { key: "1", description: "Timeline view" },
      { key: "2", description: "Flame graph view" },
      { key: "3", description: "Heatmap view" },
      { key: "f", description: "Toggle flame graph" },
      { key: "h", description: "Toggle heatmap" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { key: "⌘K", description: "Open search" },
      { key: "t", description: "Toggle theme" },
      { key: "Esc", description: "Close panel / search" },
      { key: "?", description: "Toggle this help" },
    ],
  },
];

let panelEl: HTMLElement | null = null;
let isVisible = false;

function createPanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "shortcuts-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Keyboard shortcuts");
  panel.setAttribute("aria-modal", "true");
  panel.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    opacity: 0;
    transition: opacity 200ms ease;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    background: var(--color-surface, #111113);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.06));
    border-radius: 16px;
    padding: 28px 32px;
    min-width: 420px;
    max-width: 520px;
    box-shadow: 0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03);
    transform: scale(0.95) translateY(8px);
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
  `;

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--color-text,#fafafa);letter-spacing:-0.01em;">Keyboard Shortcuts</h3>
      <kbd style="font-size:11px;padding:2px 8px;background:var(--color-bg,#09090b);border:1px solid var(--color-border,#27272a);border-radius:6px;color:var(--color-text-muted,#a1a1aa);box-shadow:0 1px 0 var(--color-border,#27272a);">?</kbd>
    </div>
  `;

  for (const group of SHORTCUT_GROUPS) {
    html += `
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-text-faint,#71717a);margin-bottom:8px;">${group.title}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
    `;
    for (const s of group.shortcuts) {
      html += `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:4px 8px;border-radius:6px;transition:background 120ms ease;" onmouseover="this.style.background='var(--color-surface-raised,#18181b)'" onmouseout="this.style.background='transparent'">
          <span style="font-size:13px;color:var(--color-text-secondary,#d4d4d8);">${s.description}</span>
          <kbd style="font-size:11px;padding:2px 8px;background:var(--color-bg,#09090b);border:1px solid var(--color-border,#27272a);border-radius:6px;color:var(--color-text,#fafafa);white-space:nowrap;box-shadow:0 1px 0 var(--color-border,#27272a);">${s.key}</kbd>
        </div>
      `;
    }
    html += `</div></div>`;
  }

  card.innerHTML = html;
  panel.appendChild(card);

  // Click outside to close
  panel.addEventListener("click", (e) => {
    if (e.target === panel) hideShortcutsPanel();
  });

  // Animate in after append
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.style.opacity = "1";
      card.style.transform = "scale(1) translateY(0)";
    });
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
  panelEl = createPanel();
  document.body.appendChild(panelEl);
  isVisible = true;
}

export function hideShortcutsPanel(): void {
  if (!isVisible || !panelEl) return;
  const panel = panelEl;
  const card = panel.firstElementChild as HTMLElement;

  panel.style.opacity = "0";
  if (card) card.style.transform = "scale(0.95) translateY(8px)";

  setTimeout(() => {
    panel.remove();
  }, 200);

  isVisible = false;
  panelEl = null;
}

export function isShortcutsPanelVisible(): boolean {
  return isVisible;
}
