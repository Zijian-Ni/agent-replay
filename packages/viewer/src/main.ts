/**
 * Agent Replay — Trace Viewer
 * Main entry point. Initializes all components, loads demo data,
 * and wires keyboard navigation and file upload.
 */

import { renderTimeline, highlightStep, getSelectedIndex, setSelectedIndex, getStepCount } from "./components/timeline.js";
import { renderInspector } from "./components/inspector.js";
import { renderCostPanel } from "./components/cost-panel.js";
import { initSearch, openSearch, closeSearch } from "./components/search.js";
import { initKeyboard } from "./components/keyboard.js";
import { initTheme, toggleTheme } from "./utils/theme.js";
import { formatDuration, formatCost, formatDate } from "./utils/format.js";
import { loadSampleTraces, loadFileAsTraces, buildCostBreakdown } from "./trace-loader.js";
import type { Trace } from "./types.js";

/* ================================================================== */
/*  Initialize app                                                     */
/* ================================================================== */

function init(): void {
  initTheme();

  let traces: Trace[] = loadSampleTraces();
  let activeTrace: Trace = traces[0]!;

  // --- DOM references ---
  const traceListEl = document.getElementById("trace-list")!;
  const timelineContainer = document.getElementById("timeline-container")!;
  const inspectorContent = document.getElementById("inspector-content")!;
  const costFooter = document.getElementById("cost-footer")!;
  const timelineTitle = document.getElementById("timeline-title")!;
  const timelineMeta = document.getElementById("timeline-meta")!;
  const themeToggle = document.getElementById("theme-toggle")!;
  const searchTrigger = document.getElementById("search-trigger")!;
  const traceSearchInput = document.getElementById("trace-search") as HTMLInputElement;
  const fileUploadBtn = document.getElementById("file-upload-btn");
  const fileInput = document.getElementById("file-input") as HTMLInputElement | null;
  const dropOverlay = document.getElementById("drop-overlay");

  // --- Render trace list ---
  function renderTraceList(filter = ""): void {
    const q = filter.toLowerCase();
    const filtered = traces.filter((t) => t.name.toLowerCase().includes(q));

    traceListEl.innerHTML = filtered
      .map(
        (trace) => `
      <div class="trace-item" role="option" data-trace-id="${trace.id}"
           aria-selected="${trace.id === activeTrace.id}">
        <span class="trace-item-name">${escapeHtml(trace.name)}</span>
        <span class="trace-item-meta">
          <span>${trace.summary?.totalSteps ?? trace.steps.length} steps</span>
          <span>${formatDuration(trace.duration ?? 0)}</span>
          ${trace.summary ? `<span>${formatCost(trace.summary.totalCost)}</span>` : ""}
        </span>
      </div>
    `,
      )
      .join("");

    traceListEl.querySelectorAll<HTMLElement>(".trace-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-trace-id");
        const trace = traces.find((t) => t.id === id);
        if (trace) {
          activeTrace = trace;
          loadTrace(trace);
          renderTraceList(filter);
        }
      });
    });
  }

  // --- Load a trace ---
  function loadTrace(trace: Trace): void {
    // Header
    timelineTitle.textContent = trace.name;
    timelineMeta.innerHTML = `
      <span class="timeline-meta-item">${trace.summary?.totalSteps ?? trace.steps.length} steps</span>
      <span class="timeline-meta-item">${formatDuration(trace.duration ?? 0)}</span>
      <span class="timeline-meta-item">${formatDate(trace.startedAt)}</span>
      ${trace.summary?.errorCount ? `<span class="timeline-meta-item" style="color:var(--color-error)">${trace.summary.errorCount} error${trace.summary.errorCount > 1 ? "s" : ""}</span>` : ""}
    `;

    // Reset inspector
    inspectorContent.innerHTML = `
      <div class="inspector-empty">
        <p class="inspector-empty-text">Select a step to inspect</p>
        <p class="inspector-empty-hint">Use <kbd>j</kbd>/<kbd>k</kbd> to navigate, <kbd>Enter</kbd> to expand</p>
      </div>
    `;

    // Timeline — Step type is structurally compatible with the timeline component's local Step type
    renderTimeline(timelineContainer, trace.steps as never[], (step: unknown) => {
      renderInspector(inspectorContent, step as never);
    });

    // Cost footer
    const breakdown = buildCostBreakdown(trace.steps);
    renderCostPanel(costFooter, breakdown as never);

    // Search
    initSearch(trace.steps as never[], (stepId: string | null) => {
      if (stepId) highlightStep(stepId);
    });
  }

  // --- Add traces from file ---
  function addTracesFromFile(loaded: Trace[]): void {
    if (loaded.length === 0) return;
    traces = [...traces, ...loaded];
    activeTrace = loaded[0]!;
    renderTraceList(traceSearchInput.value);
    loadTrace(activeTrace);
  }

  // --- Wire sidebar filter ---
  traceSearchInput.addEventListener("input", () => {
    renderTraceList(traceSearchInput.value);
  });

  // --- Wire theme toggle ---
  themeToggle.addEventListener("click", () => toggleTheme());

  // --- Wire search trigger ---
  searchTrigger.addEventListener("click", () => openSearch());

  // --- Wire file upload ---
  if (fileUploadBtn && fileInput) {
    fileUploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const files = fileInput.files;
      if (!files || files.length === 0) return;
      try {
        for (const file of Array.from(files)) {
          const loaded = await loadFileAsTraces(file);
          addTracesFromFile(loaded);
        }
      } catch (err) {
        console.error("Failed to load file:", err);
      }
      fileInput.value = "";
    });
  }

  // --- Wire drag and drop ---
  if (dropOverlay) {
    let dragCounter = 0;

    document.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) dropOverlay.hidden = false;
    });

    document.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) dropOverlay.hidden = true;
    });

    document.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    document.addEventListener("drop", async (e) => {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.hidden = true;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      try {
        for (const file of Array.from(files)) {
          if (file.name.endsWith(".jsonl") || file.name.endsWith(".json")) {
            const loaded = await loadFileAsTraces(file);
            addTracesFromFile(loaded);
          }
        }
      } catch (err) {
        console.error("Failed to load dropped file:", err);
      }
    });
  }

  // --- Keyboard navigation ---
  initKeyboard({
    onNextStep: () => {
      const count = getStepCount();
      if (count === 0) return;
      const idx = getSelectedIndex();
      setSelectedIndex(Math.min(idx + 1, count - 1));
    },
    onPrevStep: () => {
      const count = getStepCount();
      if (count === 0) return;
      const idx = getSelectedIndex();
      setSelectedIndex(Math.max(idx - 1, 0));
    },
    onSelectStep: () => {
      if (getSelectedIndex() < 0 && getStepCount() > 0) {
        setSelectedIndex(0);
      }
    },
    onOpenSearch: () => openSearch(),
    onCloseSearch: () => closeSearch(),
  });

  // --- Initial render ---
  renderTraceList();
  loadTrace(activeTrace);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Boot
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
