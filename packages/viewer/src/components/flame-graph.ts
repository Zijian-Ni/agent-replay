/**
 * Flame Graph component — visualizes step timings like Chrome Performance tab.
 * Each bar represents a step; width = duration, nesting = call depth.
 */

interface FlameStep {
  id: string;
  name: string;
  type: string;
  duration?: number;
  startedAt: Date | string;
  children: FlameStep[];
  tokens?: { total: number };
  cost?: number;
  model?: string;
}

interface FlameBar {
  step: FlameStep;
  depth: number;
  startOffset: number;
  width: number;
}

const TYPE_COLORS: Record<string, string> = {
  llm_call: "#3b82f6",
  tool_call: "#22c55e",
  tool_result: "#86efac",
  decision: "#eab308",
  error: "#ef4444",
  custom: "#8b5cf6",
};

let bars: FlameBar[] = [];
let onSelectCb: ((step: FlameStep) => void) | undefined;

function computeBars(steps: FlameStep[], traceStart: number, totalDuration: number): FlameBar[] {
  const result: FlameBar[] = [];

  function walk(step: FlameStep, depth: number): void {
    const start = new Date(step.startedAt).getTime();
    const dur = step.duration ?? 0;
    const startOffset = totalDuration > 0 ? ((start - traceStart) / totalDuration) * 100 : 0;
    const width = totalDuration > 0 ? (dur / totalDuration) * 100 : 0;

    result.push({ step, depth, startOffset: Math.max(0, startOffset), width: Math.max(0.5, width) });
    for (const child of step.children) {
      walk(child, depth + 1);
    }
  }

  for (const step of steps) {
    walk(step, 0);
  }

  return result;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderFlameGraph(
  container: HTMLElement,
  steps: FlameStep[],
  traceDuration: number,
  traceStart: number,
  onSelect?: (step: FlameStep) => void,
): void {
  onSelectCb = onSelect;
  bars = computeBars(steps, traceStart, traceDuration);

  const maxDepth = bars.reduce((max, b) => Math.max(max, b.depth), 0);
  const rowHeight = 28;
  const height = (maxDepth + 1) * rowHeight + 40;

  container.innerHTML = `
    <div class="flame-graph" style="position:relative;height:${height}px;overflow-x:auto;overflow-y:hidden;">
      <div class="flame-graph-canvas" style="position:relative;min-width:100%;height:100%;">
        ${bars.map((bar, i) => {
          const color = TYPE_COLORS[bar.step.type] ?? "#6b7280";
          const top = bar.depth * rowHeight + 4;
          const label = bar.step.name.length > 30 ? bar.step.name.slice(0, 27) + "..." : bar.step.name;
          const durLabel = bar.step.duration != null ? `${bar.step.duration}ms` : "";
          return `<div class="flame-bar" data-index="${i}"
            style="position:absolute;left:${bar.startOffset}%;width:${bar.width}%;top:${top}px;height:${rowHeight - 2}px;background:${color};border-radius:3px;cursor:pointer;overflow:hidden;white-space:nowrap;font-size:11px;line-height:${rowHeight - 2}px;padding:0 4px;color:#fff;opacity:0.9;transition:opacity 0.15s;"
            title="${escapeHtml(bar.step.name)} (${durLabel})"
            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.9'">
            ${escapeHtml(label)} ${durLabel ? `<span style="opacity:0.7;margin-left:4px">${durLabel}</span>` : ""}
          </div>`;
        }).join("")}
      </div>
    </div>
  `;

  container.querySelectorAll<HTMLElement>(".flame-bar").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index ?? "-1", 10);
      if (idx >= 0 && idx < bars.length && onSelectCb) {
        onSelectCb(bars[idx]!.step);
      }
    });
  });
}
