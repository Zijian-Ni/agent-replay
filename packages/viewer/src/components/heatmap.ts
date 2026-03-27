/**
 * Token usage heatmap — shows which steps burn the most tokens.
 * Steps are colored from cool (blue) to hot (red) based on token usage.
 */

interface HeatmapStep {
  id: string;
  name: string;
  type: string;
  tokens?: { prompt: number; completion: number; total: number };
  cost?: number;
  children: HeatmapStep[];
}

interface HeatmapEntry {
  step: HeatmapStep;
  tokens: number;
  percentage: number;
}

function flattenSteps(steps: HeatmapStep[]): HeatmapStep[] {
  const result: HeatmapStep[] = [];
  for (const s of steps) {
    result.push(s);
    if (s.children.length > 0) result.push(...flattenSteps(s.children));
  }
  return result;
}

function getHeatColor(percentage: number): string {
  // Cool (blue) → Warm (yellow) → Hot (red)
  if (percentage < 0.25) {
    const t = percentage / 0.25;
    return `hsl(${220 - t * 60}, 70%, ${50 + t * 10}%)`;
  }
  if (percentage < 0.5) {
    const t = (percentage - 0.25) / 0.25;
    return `hsl(${160 - t * 100}, 70%, ${60 - t * 10}%)`;
  }
  if (percentage < 0.75) {
    const t = (percentage - 0.5) / 0.25;
    return `hsl(${60 - t * 30}, 80%, ${50}%)`;
  }
  const t = (percentage - 0.75) / 0.25;
  return `hsl(${30 - t * 30}, 90%, ${50 - t * 10}%)`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderHeatmap(
  container: HTMLElement,
  steps: HeatmapStep[],
  onSelect?: (step: HeatmapStep) => void,
): void {
  const flat = flattenSteps(steps).filter((s) => s.tokens && s.tokens.total > 0);
  const maxTokens = Math.max(...flat.map((s) => s.tokens?.total ?? 0), 1);

  const entries: HeatmapEntry[] = flat
    .map((step) => ({
      step,
      tokens: step.tokens?.total ?? 0,
      percentage: (step.tokens?.total ?? 0) / maxTokens,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  if (entries.length === 0) {
    container.innerHTML = `<div class="heatmap-empty" style="padding:2rem;text-align:center;color:var(--color-text-muted);">No token usage data available</div>`;
    return;
  }

  container.innerHTML = `
    <div class="heatmap" style="display:flex;flex-direction:column;gap:2px;padding:0.5rem;">
      <div class="heatmap-legend" style="display:flex;align-items:center;gap:8px;padding:0.25rem 0;font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">
        <span>Low</span>
        <div style="display:flex;height:12px;flex:1;border-radius:3px;overflow:hidden;">
          ${[0, 0.25, 0.5, 0.75, 1].map((p) => `<div style="flex:1;background:${getHeatColor(p)}"></div>`).join("")}
        </div>
        <span>High</span>
      </div>
      ${entries.map((entry, i) => {
        const color = getHeatColor(entry.percentage);
        const name = entry.step.name.length > 40 ? entry.step.name.slice(0, 37) + "..." : entry.step.name;
        return `<div class="heatmap-row" data-index="${i}"
          style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:4px;cursor:pointer;transition:background 0.15s;"
          onmouseover="this.style.background='var(--color-surface-hover)'" onmouseout="this.style.background='transparent'">
          <div style="width:12px;height:12px;border-radius:2px;background:${color};flex-shrink:0;"></div>
          <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(entry.step.name)}">${escapeHtml(name)}</span>
          <span style="font-size:12px;color:var(--color-text-muted);font-variant-numeric:tabular-nums;">${entry.tokens.toLocaleString()} tok</span>
          <div style="width:80px;height:8px;background:var(--color-surface);border-radius:4px;overflow:hidden;flex-shrink:0;">
            <div style="height:100%;width:${entry.percentage * 100}%;background:${color};border-radius:4px;"></div>
          </div>
        </div>`;
      }).join("")}
    </div>
  `;

  container.querySelectorAll<HTMLElement>(".heatmap-row").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index ?? "-1", 10);
      if (idx >= 0 && idx < entries.length && onSelect) {
        onSelect(entries[idx]!.step);
      }
    });
  });
}
