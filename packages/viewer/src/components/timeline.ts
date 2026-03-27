/**
 * Timeline component — renders trace steps as vertical cards.
 */

import { formatDuration, formatTokens } from "../utils/format.js";

/* ------------------------------------------------------------------ */
/*  Local types (mirrors core types for standalone use)                */
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

function renderStepCard(step: Step, depth: number, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "step-card";
  card.setAttribute("role", "listitem");
  card.setAttribute("tabindex", "0");
  card.setAttribute("data-type", step.type);
  card.setAttribute("data-depth", String(Math.min(depth, 5)));
  card.setAttribute("data-step-id", step.id);
  card.setAttribute("data-index", String(index));

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
        ${step.duration != null ? `<span class="step-meta-item">${formatDuration(step.duration)}</span>` : ""}
        ${step.tokens ? `<span class="step-meta-item">${formatTokens(step.tokens.total)} tokens</span>` : ""}
        ${step.error ? `<span class="step-error-indicator">Error</span>` : ""}
      </div>
      ${
        step.duration != null
          ? `<div class="step-duration-bar"><div class="step-duration-fill" style="width:${pct}%"></div></div>`
          : ""
      }
    </div>
  `;

  card.addEventListener("click", () => selectByIndex(index));

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
        <svg class="timeline-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No steps to display</p>
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
