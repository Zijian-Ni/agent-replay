/**
 * Inspector panel — shows detailed info for the selected step.
 */

import {
  formatDuration,
  formatCost,
  formatTokens,
  formatDate,
  syntaxHighlightJson,
} from "../utils/format.js";

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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function typeBadgeClass(type: string): string {
  return `inspector-type-badge inspector-type-badge--${type}`;
}

function typeDisplayName(type: string): string {
  const map: Record<string, string> = {
    llm_call: "LLM Call",
    tool_call: "Tool Call",
    tool_result: "Tool Result",
    decision: "Decision",
    error: "Error",
    custom: "Custom",
  };
  return map[type] ?? type;
}

function renderSection(title: string, content: string): string {
  return `
    <div class="inspector-section">
      <div class="inspector-section-header">${escapeHtml(title)}</div>
      ${content}
    </div>
  `;
}

function renderMetaGrid(pairs: [string, string][]): string {
  const rows = pairs
    .map(
      ([label, value]) => `
      <span class="inspector-meta-label">${escapeHtml(label)}</span>
      <span class="inspector-meta-value">${value}</span>
    `,
    )
    .join("");
  return `<div class="inspector-meta-grid">${rows}</div>`;
}

function renderTokens(tokens: TokenUsage): string {
  return `
    <div class="inspector-tokens">
      <div class="inspector-token-stat">
        <span class="inspector-token-value">${formatTokens(tokens.prompt)}</span>
        <span class="inspector-token-label">Prompt</span>
      </div>
      <div class="inspector-token-stat">
        <span class="inspector-token-value">${formatTokens(tokens.completion)}</span>
        <span class="inspector-token-label">Completion</span>
      </div>
      <div class="inspector-token-stat">
        <span class="inspector-token-value">${formatTokens(tokens.total)}</span>
        <span class="inspector-token-label">Total</span>
      </div>
    </div>
  `;
}

function renderError(error: StepError): string {
  return `
    <div class="inspector-error">
      <div class="inspector-error-title">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.5a1 1 0 110-2 1 1 0 010 2z"/></svg>
        Error${error.code ? ` <span class="inspector-error-code">${escapeHtml(error.code)}</span>` : ""}
      </div>
      <div class="inspector-error-message">${escapeHtml(error.message)}</div>
      ${error.stack ? `<pre class="inspector-error-stack">${escapeHtml(error.stack)}</pre>` : ""}
    </div>
  `;
}

function renderJsonBlock(label: string, data: unknown): string {
  const id = `inspector-${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
  return `
    <div class="inspector-section">
      <button
        class="inspector-collapse-btn"
        aria-expanded="true"
        aria-controls="${id}"
        onclick="const tgt=document.getElementById('${id}');if(tgt){const h=tgt.hidden;tgt.hidden=!h;this.setAttribute('aria-expanded',String(h));}"
      >
        <svg class="inspector-collapse-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.5 2.5l4 3.5-4 3.5"/></svg>
        ${escapeHtml(label)}
      </button>
      <pre class="inspector-json" id="${id}">${syntaxHighlightJson(data)}</pre>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function renderInspector(container: HTMLElement, step: Step): void {
  const metaPairs: [string, string][] = [
    ["Type", `<span class="${typeBadgeClass(step.type)}">${typeDisplayName(step.type)}</span>`],
    ["Name", escapeHtml(step.name)],
    ["ID", `<span class="inspector-meta-value--mono">${escapeHtml(step.id)}</span>`],
  ];

  if (step.model) {
    metaPairs.push(["Model", `<span class="inspector-meta-value--mono">${escapeHtml(step.model)}</span>`]);
  }

  metaPairs.push(["Started", formatDate(step.startedAt)]);

  if (step.endedAt) {
    metaPairs.push(["Ended", formatDate(step.endedAt)]);
  }

  if (step.duration != null) {
    metaPairs.push(["Duration", formatDuration(step.duration)]);
  }

  if (step.cost != null) {
    metaPairs.push(["Cost", formatCost(step.cost)]);
  }

  let html = renderSection("Details", renderMetaGrid(metaPairs));

  if (step.tokens) {
    html += renderSection("Token Usage", renderTokens(step.tokens));
  }

  if (step.error) {
    html += renderSection("Error", renderError(step.error));
  }

  html += renderJsonBlock("Input", step.input);

  if (step.output !== undefined) {
    html += renderJsonBlock("Output", step.output);
  }

  if (step.metadata && Object.keys(step.metadata).length > 0) {
    html += renderJsonBlock("Metadata", step.metadata);
  }

  container.innerHTML = html;
}
