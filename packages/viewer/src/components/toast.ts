/**
 * Toast notification system — shows ephemeral messages with smooth animations.
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
  info: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v.5a.75.75 0 01-1.5 0v-.5zM7 7h2v4.25a.75.75 0 01-1.5 0V8.5H7a.5.5 0 010-1z"/></svg>`,
  success: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.22 5.28l-3.5 3.5a.75.75 0 01-1.06 0l-1.5-1.5a.75.75 0 111.06-1.06l.97.97 2.97-2.97a.75.75 0 011.06 1.06z"/></svg>`,
  error: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 110-2 1 1 0 010 2z"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm.53 4.746v3a.75.75 0 01-1.5 0v-3a.75.75 0 011.5 0zM8 12a1 1 0 110-2 1 1 0 010 2z"/></svg>`,
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
    bottom: 68px;
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
  toast.setAttribute("role", "alert");
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--color-surface, #111113);
    border: 1px solid ${color}30;
    border-left: 3px solid ${color};
    border-radius: 10px;
    color: var(--color-text, #fafafa);
    font-size: 13px;
    font-family: var(--font-sans, system-ui);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03);
    pointer-events: auto;
    opacity: 0;
    transform: translateX(24px) scale(0.95);
    transition: opacity 250ms cubic-bezier(0.16, 1, 0.3, 1),
                transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
    max-width: 360px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  `;
  toast.innerHTML = `
    <span style="color:${color};flex-shrink:0;display:flex;">${TOAST_ICONS[type]}</span>
    <span style="flex:1">${escapeHtml(options.message)}</span>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0) scale(1)";
    });
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(24px) scale(0.95)";
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
