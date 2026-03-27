/**
 * Diff viewer — side-by-side comparison of two traces.
 */

import { formatTokens, formatCost, formatDuration } from "../utils/format.js";

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface Step {
  id: string;
  type: string;
  name: string;
  startedAt: Date | string;
  duration?: number;
  tokens?: TokenUsage;
  cost?: number;
  model?: string;
  children: Step[];
  [key: string]: unknown;
}

interface TraceDiff {
  added: Step[];
  removed: Step[];
  modified: Array<{ before: Step; after: Step; changes: string[] }>;
  summary: {
    tokenDiff: number;
    costDiff: number;
    durationDiff: number;
    stepCountDiff: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function signedValue(n: number, formatter: (v: number) => string): string {
  if (n === 0) return `<span class="diff-stat-value diff-stat-value--neutral">0</span>`;
  const cls = n > 0 ? "diff-stat-value--positive" : "diff-stat-value--negative";
  const sign = n > 0 ? "+" : "";
  return `<span class="diff-stat-value ${cls}">${sign}${formatter(Math.abs(n))}</span>`;
}

function renderStepList(steps: Step[], className: string): string {
  if (steps.length === 0) return '<p class="search-empty">None</p>';
  return steps
    .map(
      (s) => `
    <div class="diff-step ${className}">
      <span class="step-badge step-badge--${s.type}">${escapeHtml(s.type)}</span>
      ${escapeHtml(s.name)}
    </div>
  `,
    )
    .join("");
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function renderDiffView(container: HTMLElement, diff: TraceDiff): void {
  const { summary, added, removed, modified } = diff;

  const html = `
    <div class="diff-view">
      <div class="diff-summary">
        <div class="diff-stat">
          ${signedValue(summary.stepCountDiff, (n) => String(n))}
          <span class="diff-stat-label">Steps</span>
        </div>
        <div class="diff-stat">
          ${signedValue(summary.tokenDiff, formatTokens)}
          <span class="diff-stat-label">Tokens</span>
        </div>
        <div class="diff-stat">
          ${signedValue(summary.costDiff, formatCost)}
          <span class="diff-stat-label">Cost</span>
        </div>
        <div class="diff-stat">
          ${signedValue(summary.durationDiff, formatDuration)}
          <span class="diff-stat-label">Duration</span>
        </div>
      </div>

      <div class="inspector-section">
        <div class="diff-section-title">Added (${added.length})</div>
        ${renderStepList(added, "diff-step--added")}
      </div>

      <div class="inspector-section">
        <div class="diff-section-title">Removed (${removed.length})</div>
        ${renderStepList(removed, "diff-step--removed")}
      </div>

      <div class="inspector-section">
        <div class="diff-section-title">Modified (${modified.length})</div>
        ${
          modified.length === 0
            ? '<p class="search-empty">None</p>'
            : modified
                .map(
                  (m) => `
          <div class="diff-step diff-step--modified">
            <span class="step-badge step-badge--${m.after.type}">${escapeHtml(m.after.type)}</span>
            ${escapeHtml(m.after.name)}
            <div class="diff-step-changes">${m.changes.map(escapeHtml).join(", ")}</div>
          </div>
        `,
                )
                .join("")
        }
      </div>
    </div>
  `;

  container.innerHTML = html;
}
