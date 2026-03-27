/**
 * Right-click context menu for step cards in the timeline.
 * Provides quick actions: copy JSON, copy step ID, jump to parent, etc.
 */

import { showToast } from "./toast.js";

let menuEl: HTMLElement | null = null;

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function createMenu(): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");
  menu.style.display = "none";
  document.body.appendChild(menu);
  return menu;
}

function hideMenu(): void {
  if (menuEl) {
    menuEl.style.display = "none";
  }
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
}

function showMenu(x: number, y: number, items: MenuItem[]): void {
  if (!menuEl) menuEl = createMenu();

  menuEl.innerHTML = items
    .map(
      (item, i) => `
    <div class="context-menu-item" role="menuitem" data-index="${i}" tabindex="0">
      <span class="context-menu-item-icon">${item.icon}</span>
      <span>${escapeHtml(item.label)}</span>
    </div>
  `,
    )
    .join("");

  // Position menu within viewport
  menuEl.style.display = "block";
  menuEl.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menuEl.style.top = `${Math.min(y, window.innerHeight - items.length * 36 - 16)}px`;

  // Wire click handlers
  menuEl.querySelectorAll<HTMLElement>(".context-menu-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index ?? "-1", 10);
      if (idx >= 0 && idx < items.length) {
        items[idx]!.action();
      }
      hideMenu();
    });
  });
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast({ message: "Copied to clipboard", type: "success", duration: 1500 });
  } catch {
    showToast({ message: "Failed to copy", type: "error", duration: 1500 });
  }
}

export function initContextMenu(container: HTMLElement): void {
  // Close on any click
  document.addEventListener("click", hideMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideMenu();
  });

  container.addEventListener("contextmenu", (e: MouseEvent) => {
    // Find the closest step card
    const target = e.target as HTMLElement;
    const stepCard = target.closest<HTMLElement>(".step-card");
    if (!stepCard) return;

    e.preventDefault();

    const stepId = stepCard.dataset.stepId ?? "unknown";
    const stepType = stepCard.dataset.type ?? "unknown";
    const stepName = stepCard.querySelector(".step-name")?.textContent ?? "Step";

    const items: MenuItem[] = [
      {
        label: "Copy Step ID",
        icon: "📋",
        action: () => copyToClipboard(stepId),
      },
      {
        label: "Copy Step Name",
        icon: "📝",
        action: () => copyToClipboard(stepName),
      },
      {
        label: `Copy as JSON`,
        icon: "{ }",
        action: () => {
          const data = { id: stepId, type: stepType, name: stepName };
          copyToClipboard(JSON.stringify(data, null, 2));
        },
      },
      {
        label: "Expand All Children",
        icon: "⬇️",
        action: () => {
          // Double-click simulation to expand all children
          stepCard.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        },
      },
    ];

    showMenu(e.clientX, e.clientY, items);
  });
}
