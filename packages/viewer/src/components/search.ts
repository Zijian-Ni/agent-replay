/**
 * Search / filter component — Ctrl+K opens a modal overlay.
 */

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

interface Step {
  id: string;
  type: string;
  name: string;
  model?: string;
  children: Step[];
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let overlayEl: HTMLElement | null = null;
let inputEl: HTMLInputElement | null = null;
let resultsEl: HTMLElement | null = null;
let allSteps: Step[] = [];
let filterCallback: ((stepId: string | null) => void) | undefined;
let activeIndex = 0;
let currentResults: Step[] = [];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flattenAll(steps: Step[]): Step[] {
  const out: Step[] = [];
  for (const s of steps) {
    out.push(s);
    if (s.children.length > 0) out.push(...flattenAll(s.children));
  }
  return out;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    llm_call: "var(--color-llm)",
    tool_call: "var(--color-tool)",
    tool_result: "var(--color-tool)",
    decision: "var(--color-decision)",
    error: "var(--color-error)",
    custom: "var(--color-custom)",
  };
  return map[type] ?? "var(--color-custom)";
}

function typeBg(type: string): string {
  const map: Record<string, string> = {
    llm_call: "var(--color-llm-bg)",
    tool_call: "var(--color-tool-bg)",
    tool_result: "var(--color-tool-bg)",
    decision: "var(--color-decision-bg)",
    error: "var(--color-error-bg)",
    custom: "var(--color-custom-bg)",
  };
  return map[type] ?? "var(--color-custom-bg)";
}

function filterSteps(query: string): Step[] {
  if (!query.trim()) return allSteps.slice(0, 20);
  const q = query.toLowerCase();
  return allSteps.filter((s) => {
    return (
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      (s.model ?? "").toLowerCase().includes(q)
    );
  });
}

function renderResults(): void {
  if (!resultsEl || !inputEl) return;
  const query = inputEl.value;
  currentResults = filterSteps(query);
  activeIndex = 0;

  if (currentResults.length === 0) {
    resultsEl.innerHTML = `<div class="search-empty">No results found</div>`;
    return;
  }

  resultsEl.innerHTML = currentResults
    .map(
      (step, i) => `
    <div class="search-result-item" data-index="${i}" data-step-id="${step.id}" ${i === 0 ? 'data-active="true"' : ""}>
      <span class="search-result-badge" style="color:${typeColor(step.type)};background:${typeBg(step.type)}">${escapeHtml(step.type)}</span>
      <span class="search-result-name">${escapeHtml(step.name)}</span>
      ${step.model ? `<span class="search-result-model">${escapeHtml(step.model)}</span>` : ""}
    </div>
  `,
    )
    .join("");

  // Click handlers
  resultsEl.querySelectorAll<HTMLElement>(".search-result-item").forEach((el) => {
    el.addEventListener("click", () => {
      const stepId = el.getAttribute("data-step-id");
      if (stepId && filterCallback) {
        filterCallback(stepId);
        closeSearch();
      }
    });
  });
}

function updateActive(): void {
  if (!resultsEl) return;
  resultsEl.querySelectorAll<HTMLElement>(".search-result-item").forEach((el, i) => {
    el.setAttribute("data-active", String(i === activeIndex));
    if (i === activeIndex) el.scrollIntoView({ block: "nearest" });
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function initSearch(
  steps: Step[],
  onSelect: (stepId: string | null) => void,
): void {
  overlayEl = document.getElementById("search-overlay");
  inputEl = document.getElementById("search-input") as HTMLInputElement | null;
  resultsEl = document.getElementById("search-results");
  allSteps = flattenAll(steps);
  filterCallback = onSelect;

  if (inputEl) {
    inputEl.addEventListener("input", () => renderResults());
    inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
        updateActive();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const step = currentResults[activeIndex];
        if (step && filterCallback) {
          filterCallback(step.id);
          closeSearch();
        }
      }
    });
  }

  if (overlayEl) {
    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) closeSearch();
    });
  }
}

export function openSearch(): void {
  if (!overlayEl || !inputEl) return;
  overlayEl.hidden = false;
  inputEl.value = "";
  renderResults();
  requestAnimationFrame(() => inputEl?.focus());
}

export function closeSearch(): void {
  if (!overlayEl) return;
  overlayEl.hidden = true;
}
