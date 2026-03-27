/**
 * Cost breakdown panel — renders cost and token summaries.
 */

import { formatCost, formatTokens } from "../utils/format.js";

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface CostBreakdown {
  byModel: Record<string, { tokens: TokenUsage; cost: number; calls: number }>;
  byStepType: Record<string, { cost: number; count: number }>;
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const MODEL_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#a855f7",
  "#ec4899",
];

/* ------------------------------------------------------------------ */
/*  Render into footer bar (compact)                                   */
/* ------------------------------------------------------------------ */

export function renderCostPanel(container: HTMLElement, breakdown: CostBreakdown): void {
  const models = Object.entries(breakdown.byModel);
  const maxTokens = Math.max(...models.map(([, v]) => v.tokens.total), 1);

  // Total tokens across all models
  const totalTokens = models.reduce((sum, [, v]) => sum + v.tokens.total, 0);
  const totalCalls = models.reduce((sum, [, v]) => sum + v.calls, 0);

  let html = `
    <div class="cost-stat">
      <span class="cost-stat-label">Total Cost</span>
      <span class="cost-stat-value">${formatCost(breakdown.total)}</span>
    </div>
    <div class="cost-stat-separator"></div>
    <div class="cost-stat">
      <span class="cost-stat-label">Tokens</span>
      <span class="cost-stat-value">${formatTokens(totalTokens)}</span>
    </div>
    <div class="cost-stat-separator"></div>
    <div class="cost-stat">
      <span class="cost-stat-label">Calls</span>
      <span class="cost-stat-value">${totalCalls}</span>
    </div>
  `;

  if (models.length > 0) {
    html += `<div class="cost-stat-separator"></div>`;
    html += `<div class="cost-model-breakdown">`;
    models.forEach(([model, data], i) => {
      const color = MODEL_COLORS[i % MODEL_COLORS.length] ?? "#71717a";
      html += `
        <div class="cost-model-item" title="${escapeHtml(model)}: ${formatCost(data.cost)} / ${formatTokens(data.tokens.total)} tokens / ${data.calls} calls">
          <span class="cost-model-dot" style="background:${color}"></span>
          <span>${escapeHtml(model)}</span>
          <span style="color:var(--color-text-faint)">${formatCost(data.cost)}</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

/* ------------------------------------------------------------------ */
/*  Render detailed breakdown (for a panel / modal)                    */
/* ------------------------------------------------------------------ */

export function renderCostBreakdownDetailed(container: HTMLElement, breakdown: CostBreakdown): void {
  const models = Object.entries(breakdown.byModel);
  const maxTokens = Math.max(...models.map(([, v]) => v.tokens.total), 1);
  const stepTypes = Object.entries(breakdown.byStepType);

  let html = `<div style="padding:var(--space-4)">`;

  // By model table
  html += `
    <div class="inspector-section">
      <div class="inspector-section-header">By Model</div>
      <table class="cost-breakdown-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Cost</th>
            <th>Calls</th>
            <th>Tokens</th>
            <th style="width:100px"></th>
          </tr>
        </thead>
        <tbody>
  `;

  models.forEach(([model, data], i) => {
    const pct = (data.tokens.total / maxTokens) * 100;
    const color = MODEL_COLORS[i % MODEL_COLORS.length] ?? "#71717a";
    html += `
      <tr>
        <td style="font-family:var(--font-mono);font-size:var(--font-size-xs)">${escapeHtml(model)}</td>
        <td>${formatCost(data.cost)}</td>
        <td>${data.calls}</td>
        <td>${formatTokens(data.tokens.total)}</td>
        <td>
          <div class="cost-token-bar">
            <div class="cost-token-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;

  // By step type
  html += `
    <div class="inspector-section">
      <div class="inspector-section-header">By Step Type</div>
      <table class="cost-breakdown-table">
        <thead>
          <tr><th>Type</th><th>Cost</th><th>Count</th></tr>
        </thead>
        <tbody>
  `;

  stepTypes.forEach(([type, data]) => {
    html += `
      <tr>
        <td><span class="step-badge step-badge--${type}">${escapeHtml(type)}</span></td>
        <td>${formatCost(data.cost)}</td>
        <td>${data.count}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;
}
