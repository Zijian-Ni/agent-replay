import type { SerializedTrace, TraceId } from "../types";

export interface SidebarCallbacks {
  onTraceSelect: (traceId: TraceId) => void;
  onSearchChange: (query: string) => void;
}

export class Sidebar {
  private listEl: HTMLElement;
  private searchEl: HTMLInputElement;
  private traces: SerializedTrace[] = [];
  private filteredTraces: SerializedTrace[] = [];
  private selectedTraceId: TraceId | null = null;
  private callbacks: SidebarCallbacks;

  constructor(callbacks: SidebarCallbacks) {
    this.listEl = document.getElementById("trace-list")!;
    this.searchEl = document.getElementById("trace-search") as HTMLInputElement;
    this.callbacks = callbacks;

    this.searchEl.addEventListener("input", () => {
      const query = this.searchEl.value.trim().toLowerCase();
      this.callbacks.onSearchChange(query);
      this.filterTraces(query);
    });
  }

  setTraces(traces: SerializedTrace[]): void {
    this.traces = traces;
    this.filteredTraces = traces;
    this.render();
  }

  setSelectedTrace(traceId: TraceId | null): void {
    this.selectedTraceId = traceId;
    this.updateSelection();
  }

  private filterTraces(query: string): void {
    if (!query) {
      this.filteredTraces = this.traces;
    } else {
      this.filteredTraces = this.traces.filter((t) => {
        const name = t.name.toLowerCase();
        const id = t.id.toLowerCase();
        const models = t.summary?.models?.join(" ").toLowerCase() ?? "";
        return name.includes(query) || id.includes(query) || models.includes(query);
      });
    }
    this.render();
  }

  private render(): void {
    this.listEl.innerHTML = "";
    for (const trace of this.filteredTraces) {
      const item = document.createElement("div");
      item.className = "trace-item";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(trace.id === this.selectedTraceId));
      item.dataset.traceId = trace.id;

      const stepsCount = trace.summary?.totalSteps ?? trace.steps.length;
      const cost = trace.summary?.totalCost ?? 0;
      const duration = trace.duration ?? 0;

      item.innerHTML = `
        <span class="trace-item-name">${escapeHtml(trace.name)}</span>
        <span class="trace-item-meta">
          <span>${stepsCount} steps</span>
          <span>${formatDuration(duration)}</span>
          <span>${formatCost(cost)}</span>
        </span>
      `;

      item.addEventListener("click", () => {
        this.callbacks.onTraceSelect(trace.id);
      });

      this.listEl.appendChild(item);
    }
  }

  private updateSelection(): void {
    const items = this.listEl.querySelectorAll(".trace-item");
    items.forEach((item) => {
      const el = item as HTMLElement;
      el.setAttribute("aria-selected", String(el.dataset.traceId === this.selectedTraceId));
    });
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainSeconds}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
