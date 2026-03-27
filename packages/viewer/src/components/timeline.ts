/**
 * Timeline component — renders trace steps as vertical cards
 * with hover tooltips, smooth scroll, and staggered animations.
 */

import { formatDuration, formatTokens, formatCost } from "../utils/format.js";

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface StepError {
  message: string;
  stack?: string;
  code?: string;
}

interface Step {
  id: string;
  parentId?: string;
  type: string;
  name: string;
  startedAt: Date | string;
  endedAt?: Date | string;
  duration?: number;
  input: unknown;
  output?: unknown;
  tokens?: TokenUsage;
  cost?: number;
  model?: string;
  error?: StepError;
  children: Step[];
  metadata?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let selectedIndex = -1;
let flatSteps: { step: Step; depth: number }[] = [];
let onSelectCallback: ((step: Step) => void) | undefined;
let containerEl: HTMLElement | undefined;
let tooltipEl: HTMLElement | null = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flattenSteps(steps: Step[], depth = 0): { step: Step; depth: number }[] {
  const out: { step: Step; depth: number }[] = [];
  for (const step of steps) {
    out.push({ step, depth });
    if (step.children.length > 0) {
      out.push(...flattenSteps(step.children, depth + 1));
    }
  }
  return out;
}

function typeLabel(type: string): string {
  switch (type) {
    case "llm_call":
      return "LLM";
    case "tool_call":
      return "Tool";
    case "tool_result":
      return "Result";
    case "decision":
      return "Decision";
    case "error":
      return "Error";
    default:
      return "Custom";
  }
}

function ensureTooltip(): HTMLElement {
  if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
  tooltipEl = document.createElement("div");
  tooltipEl.className = "tooltip";
  tooltipEl.style.display = "none";
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function showTooltip(step: Step, x: number, y: number): void {
  const tip = ensureTooltip();
  let html = "";

  if (step.duration != null) {
    html += `<div class="tooltip-row"><span class="tooltip-label">Duration</span><span class="tooltip-value">${formatDuration(step.duration)}</span></div>`;
  }
  if (step.tokens) {
    html += `<div class="tooltip-row"><span class="tooltip-label">Tokens</span><span class="tooltip-value">${formatTokens(step.tokens.total)}</span></div>`;
  }
  if (step.cost != null && step.cost > 0) {
    html += `<div class="tooltip-row"><span class="tooltip-label">Cost</span><span class="tooltip-value">${formatCost(step.cost)}</span></div>`;
  }
  if (step.model) {
    html += `<div class="tooltip-row"><span class="tooltip-label">Model</span><span class="tooltip-value">${escapeHtml(step.model)}</span></div>`;
  }

  if (!html) return;

  tip.innerHTML = html;
  tip.style.display = "block";
  tip.style.left = `${Math.min(x + 12, window.innerWidth - 220)}px`;
  tip.style.top = `${Math.min(y + 12, window.innerHeight - 100)}px`;
}

function hideTooltip(): void {
  if (tooltipEl) tooltipEl.style.display = "none";
}

function renderStepCard(step: Step, depth: number, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "step-card";
  card.setAttribute("role", "listitem");
  card.setAttribute("tabindex", "0");
  card.setAttribute("data-type", step.type);
  card.setAttribute("data-depth", String(Math.min(depth, 5)));
  card.setAttribute("data-step-id", step.id);
  card.setAttribute("data-index", String(index));
  card.setAttribute("aria-label", `${typeLabel(step.type)}: ${step.name}`);

  // Duration bar width relative to longest step
  const maxDuration = Math.max(...flatSteps.map((e) => e.step.duration ?? 0), 1);
  const pct = ((step.duration ?? 0) / maxDuration) * 100;

  card.innerHTML = `
    <div class="step-dot"></div>
    <div class="step-content">
      <div class="step-header">
        <span class="step-badge step-badge--${step.type}">${typeLabel(step.type)}</span>
        <span class="step-name">${escapeHtml(step.name)}</span>
        ${step.model ? `<span class="step-model">${escapeHtml(step.model)}</span>` : ""}
      </div>
      <div class="step-meta">
        ${step.duration != null ? `<span class="step-meta-item">⏱ ${formatDuration(step.duration)}</span>` : ""}
        ${step.tokens ? `<span class="step-meta-item">🔤 ${formatTokens(step.tokens.total)} tok</span>` : ""}
        ${step.cost != null && step.cost > 0 ? `<span class="step-meta-item">💰 ${formatCost(step.cost)}</span>` : ""}
        ${step.error ? `<span class="step-error-indicator">⚠ Error</span>` : ""}
      </div>
      ${
        step.duration != null
          ? `<div class="step-duration-bar"><div class="step-duration-fill" style="width:0%"></div></div>`
          : ""
      }
    </div>
  `;

  // Animate duration bar after render
  if (step.duration != null) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = card.querySelector<HTMLElement>(".step-duration-fill");
        if (fill) fill.style.width = `${pct}%`;
      });
    });
  }

  card.addEventListener("click", () => selectByIndex(index));

  // Tooltip on hover
  card.addEventListener("mouseenter", (e: MouseEvent) => {
    showTooltip(step, e.clientX, e.clientY);
  });
  card.addEventListener("mousemove", (e: MouseEvent) => {
    if (tooltipEl && tooltipEl.style.display !== "none") {
      tooltipEl.style.left = `${Math.min(e.clientX + 12, window.innerWidth - 220)}px`;
      tooltipEl.style.top = `${Math.min(e.clientY + 12, window.innerHeight - 100)}px`;
    }
  });
  card.addEventListener("mouseleave", hideTooltip);

  return card;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function selectByIndex(index: number): void {
  if (index < 0 || index >= flatSteps.length) return;
  selectedIndex = index;
  updateSelection();
  const entry = flatSteps[index];
  if (entry && onSelectCallback) {
    onSelectCallback(entry.step);
  }
}

function updateSelection(): void {
  if (!containerEl) return;
  const cards = containerEl.querySelectorAll<HTMLElement>(".step-card");
  cards.forEach((card, i) => {
    const isSelected = i === selectedIndex;
    card.setAttribute("aria-selected", String(isSelected));
    if (isSelected) {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function renderTimeline(
  container: HTMLElement,
  steps: Step[],
  onSelect: (step: Step) => void,
): void {
  containerEl = container;
  onSelectCallback = onSelect;
  flatSteps = flattenSteps(steps);
  selectedIndex = -1;

  container.innerHTML = "";

  if (flatSteps.length === 0) {
    container.innerHTML = `
      <div class="timeline-empty">
        <svg class="timeline-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="12" cy="12" r="10" opacity="0.3"/>
          <path d="M12 6v6l4 2" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49" opacity="0.2" stroke-width="1.5"/>
        </svg>
        <p>No steps to display</p>
        <p class="empty-hint">Load a .jsonl trace file or drag & drop one here</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  flatSteps.forEach(({ step, depth }, index) => {
    fragment.appendChild(renderStepCard(step, depth, index));
  });
  container.appendChild(fragment);
}

export function highlightStep(stepId: string): void {
  const idx = flatSteps.findIndex((e) => e.step.id === stepId);
  if (idx >= 0) selectByIndex(idx);
}

export function getSelectedIndex(): number {
  return selectedIndex;
}

export function setSelectedIndex(index: number): void {
  selectByIndex(index);
}

export function getStepCount(): number {
  return flatSteps.length;
}
