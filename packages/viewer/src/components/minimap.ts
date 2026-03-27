/**
 * Minimap component — a VS Code-like minimap for navigating long traces.
 * Shows a scaled-down overview of all steps with a viewport indicator.
 */

interface MinimapStep {
  id: string;
  type: string;
  duration?: number;
  tokens?: { total: number };
  error?: { message: string };
  children: MinimapStep[];
}

const TYPE_COLORS: Record<string, string> = {
  llm_call: "#3b82f6",
  tool_call: "#22c55e",
  tool_result: "#86efac",
  decision: "#eab308",
  error: "#ef4444",
  custom: "#8b5cf6",
};

function flattenSteps(steps: MinimapStep[]): MinimapStep[] {
  const result: MinimapStep[] = [];
  for (const s of steps) {
    result.push(s);
    if (s.children.length > 0) result.push(...flattenSteps(s.children));
  }
  return result;
}

export function renderMinimap(
  container: HTMLElement,
  steps: MinimapStep[],
  onNavigate?: (index: number) => void,
): void {
  const flat = flattenSteps(steps);
  if (flat.length === 0) {
    container.innerHTML = "";
    return;
  }

  const barHeight = Math.max(2, Math.min(6, 200 / flat.length));

  container.innerHTML = `
    <div class="minimap" style="position:relative;width:48px;height:100%;overflow:hidden;background:var(--color-bg);border-left:1px solid var(--color-border);cursor:pointer;">
      <div class="minimap-bars" style="padding:4px 6px;">
        ${flat.map((step, i) => {
          const color = step.error ? TYPE_COLORS.error : (TYPE_COLORS[step.type] ?? "#6b7280");
          return `<div class="minimap-bar" data-index="${i}" style="height:${barHeight}px;margin-bottom:1px;background:${color};border-radius:1px;opacity:0.6;"></div>`;
        }).join("")}
      </div>
      <div class="minimap-viewport" style="position:absolute;top:0;left:0;right:0;height:40px;background:var(--color-accent);opacity:0.15;border-radius:2px;pointer-events:none;transition:top 0.1s;"></div>
    </div>
  `;

  const minimap = container.querySelector<HTMLElement>(".minimap");
  if (minimap && onNavigate) {
    minimap.addEventListener("click", (e) => {
      const rect = minimap.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      const index = Math.floor(ratio * flat.length);
      onNavigate(Math.max(0, Math.min(index, flat.length - 1)));
    });
  }
}

/** Update the viewport position on the minimap based on scroll position */
export function updateMinimapViewport(container: HTMLElement, scrollRatio: number, viewRatio: number): void {
  const viewport = container.querySelector<HTMLElement>(".minimap-viewport");
  if (!viewport) return;
  const minimap = container.querySelector<HTMLElement>(".minimap");
  if (!minimap) return;

  const height = minimap.clientHeight;
  viewport.style.top = `${scrollRatio * height}px`;
  viewport.style.height = `${Math.max(20, viewRatio * height)}px`;
}
