/**
 * Toast notification system — shows ephemeral messages for user actions.
 */

type ToastType = "info" | "success" | "error" | "warning";

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

const TOAST_COLORS: Record<ToastType, string> = {
  info: "#3b82f6",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#eab308",
};

const TOAST_ICONS: Record<ToastType, string> = {
  info: "&#9432;",
  success: "&#10003;",
  error: "&#10007;",
  warning: "&#9888;",
};

let containerEl: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (containerEl && document.body.contains(containerEl)) return containerEl;

  containerEl = document.createElement("div");
  containerEl.className = "toast-container";
  containerEl.setAttribute("aria-live", "polite");
  containerEl.setAttribute("aria-atomic", "true");
  containerEl.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    pointer-events: none;
  `;
  document.body.appendChild(containerEl);
  return containerEl;
}

export function showToast(options: ToastOptions): void {
  const container = ensureContainer();
  const type = options.type ?? "info";
  const duration = options.duration ?? 3000;
  const color = TOAST_COLORS[type];

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--color-surface, #1c2128);
    border: 1px solid ${color}40;
    border-left: 3px solid ${color};
    border-radius: 6px;
    color: var(--color-text, #c9d1d9);
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: auto;
    opacity: 0;
    transform: translateX(20px);
    transition: opacity 0.2s, transform 0.2s;
    max-width: 360px;
  `;
  toast.innerHTML = `
    <span style="color:${color};font-size:16px;">${TOAST_ICONS[type]}</span>
    <span>${escapeHtml(options.message)}</span>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
