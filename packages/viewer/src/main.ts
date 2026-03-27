/**
 * Agent Replay — Trace Viewer
 * Main entry point. Initializes all components, loads demo data,
 * wires keyboard navigation, file upload, resize handles, and interactions.
 */

import { renderTimeline, highlightStep, getSelectedIndex, setSelectedIndex, getStepCount } from "./components/timeline.js";
import { renderInspector } from "./components/inspector.js";
import { renderCostPanel } from "./components/cost-panel.js";
import { initSearch, openSearch, closeSearch } from "./components/search.js";
import { initKeyboard } from "./components/keyboard.js";
import { initTheme, toggleTheme } from "./utils/theme.js";
import { formatDuration, formatCost, formatDate } from "./utils/format.js";
import { loadSampleTraces, loadFileAsTraces, buildCostBreakdown } from "./trace-loader.js";
import { renderFlameGraph } from "./components/flame-graph.js";
import { renderHeatmap } from "./components/heatmap.js";
import { renderMinimap, updateMinimapViewport } from "./components/minimap.js";
import { showToast } from "./components/toast.js";
import { toggleShortcutsPanel, hideShortcutsPanel } from "./components/shortcuts-panel.js";
import { downloadHtml } from "./components/export-html.js";
import { initResizeHandle } from "./components/resize.js";
import { initContextMenu } from "./components/context-menu.js";
import type { Trace } from "./types.js";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type ViewMode = "timeline" | "flamegraph" | "heatmap";

/* ================================================================== */
/*  Initialize app                                                     */
/* ================================================================== */

function init(): void {
  initTheme();

  // Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const stored = localStorage.getItem("agent-replay-theme");
    if (!stored) initTheme();
  });

  let traces: Trace[] = loadSampleTraces();
  let activeTrace: Trace = traces[0]!;
  let currentView: ViewMode = "timeline";

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
  const minimapContainer = document.getElementById("minimap-container");
  const exportBtn = document.getElementById("export-btn");
  const shortcutsBtn = document.getElementById("shortcuts-btn");
  const headerSubtitle = document.getElementById("header-subtitle");
  const sidebar = document.getElementById("sidebar") as HTMLElement;
  const inspectorPanel = document.getElementById("inspector-panel") as HTMLElement;

  // View tab buttons
  const viewTabs = document.querySelectorAll<HTMLElement>("[data-view-tab]");

  // --- Initialize drag-to-resize panels ---
  initResizeHandle("resize-sidebar", sidebar, "left", 180, 400);
  initResizeHandle("resize-inspector", inspectorPanel, "right", 260, 600);

  // --- Initialize right-click context menu on timeline ---
  initContextMenu(timelineContainer);

  // --- Update page title ---
  function updatePageTitle(traceName: string): void {
    document.title = `${traceName} — Agent Replay`;
    if (headerSubtitle) {
      headerSubtitle.textContent = traceName;
    }
  }

  // --- View switching ---
  function switchView(view: ViewMode): void {
    currentView = view;
    viewTabs.forEach((tab) => {
      const isActive = tab.dataset.viewTab === view;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
    loadTrace(activeTrace);
  }

  viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.viewTab as ViewMode;
      if (view) switchView(view);
    });
  });

  // --- Render trace list ---
  function renderTraceList(filter = ""): void {
    const q = filter.toLowerCase();
    const filtered = traces.filter((t) => t.name.toLowerCase().includes(q));

    traceListEl.innerHTML = filtered
      .map(
        (trace) => `
      <div class="trace-item" role="option" data-trace-id="${trace.id}"
           aria-selected="${trace.id === activeTrace.id}" tabindex="0">
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
    updatePageTitle(trace.name);

    // Header
    timelineTitle.textContent = trace.name;
    timelineMeta.innerHTML = `
      <span class="timeline-meta-item">${trace.summary?.totalSteps ?? trace.steps.length} steps</span>
      <span class="timeline-meta-item">${formatDuration(trace.duration ?? 0)}</span>
      <span class="timeline-meta-item">${formatDate(trace.startedAt)}</span>
      ${trace.summary?.errorCount ? `<span class="timeline-meta-item" style="color:var(--color-error)">${trace.summary.errorCount} error${trace.summary.errorCount > 1 ? "s" : ""}</span>` : ""}
    `;

    // Reset inspector with styled empty state
    inspectorContent.innerHTML = `
      <div class="inspector-empty">
        <svg class="inspector-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="18" rx="3"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <path d="M13 8h4" opacity="0.4"/>
          <path d="M13 12h4" opacity="0.3"/>
          <path d="M13 16h2" opacity="0.2"/>
        </svg>
        <p class="inspector-empty-text">Select a step to inspect</p>
        <p class="inspector-empty-hint">Use <kbd>j</kbd>/<kbd>k</kbd> to navigate · <kbd>Enter</kbd> to expand</p>
      </div>
    `;

    // Render based on view mode
    if (currentView === "timeline") {
      renderTimeline(timelineContainer, trace.steps as never[], (step: unknown) => {
        renderInspector(inspectorContent, step as never);
      });
    } else if (currentView === "flamegraph") {
      const traceStart = trace.startedAt.getTime();
      const traceDuration = trace.duration ?? 0;
      renderFlameGraph(timelineContainer, trace.steps as never[], traceDuration, traceStart, (step: unknown) => {
        renderInspector(inspectorContent, step as never);
      });
    } else if (currentView === "heatmap") {
      renderHeatmap(timelineContainer, trace.steps as never[], (step: unknown) => {
        renderInspector(inspectorContent, step as never);
      });
    }

    // Cost footer
    const breakdown = buildCostBreakdown(trace.steps);
    renderCostPanel(costFooter, breakdown as never);

    // Search
    initSearch(trace.steps as never[], (stepId: string | null) => {
      if (stepId) highlightStep(stepId);
    });

    // Minimap
    if (minimapContainer) {
      renderMinimap(minimapContainer, trace.steps as never[], (index: number) => {
        setSelectedIndex(index);
      });

      // Wire up minimap viewport tracking
      timelineContainer.addEventListener("scroll", () => {
        const scrollRatio = timelineContainer.scrollTop / (timelineContainer.scrollHeight || 1);
        const viewRatio = timelineContainer.clientHeight / (timelineContainer.scrollHeight || 1);
        updateMinimapViewport(minimapContainer, scrollRatio, viewRatio);
      });
    }
  }

  // --- Add traces from file ---
  function addTracesFromFile(loaded: Trace[]): void {
    if (loaded.length === 0) return;
    traces = [...traces, ...loaded];
    activeTrace = loaded[0]!;
    renderTraceList(traceSearchInput.value);
    loadTrace(activeTrace);
    showToast({ message: `Loaded ${loaded.length} trace(s)`, type: "success" });
  }

  // --- Wire sidebar filter ---
  traceSearchInput.addEventListener("input", () => {
    renderTraceList(traceSearchInput.value);
  });

  // --- Wire theme toggle ---
  themeToggle.addEventListener("click", () => {
    const newTheme = toggleTheme();
    showToast({ message: `Switched to ${newTheme} theme`, type: "info", duration: 1500 });
  });

  // --- Wire search trigger ---
  searchTrigger.addEventListener("click", () => openSearch());

  // --- Wire shortcuts button ---
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener("click", () => toggleShortcutsPanel());
  }

  // --- Wire export button ---
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      downloadHtml(activeTrace as never);
      showToast({ message: "Trace exported as HTML", type: "success" });
    });
  }

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
        showToast({ message: `Failed to load file: ${(err as Error).message}`, type: "error" });
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
        showToast({ message: `Failed to load dropped file: ${(err as Error).message}`, type: "error" });
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

  // --- Additional keyboard shortcuts ---
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === "?") {
      e.preventDefault();
      toggleShortcutsPanel();
    }
    if (e.key === "Escape") {
      hideShortcutsPanel();
    }
    if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
      const newTheme = toggleTheme();
      showToast({ message: `Switched to ${newTheme} theme`, type: "info", duration: 1500 });
    }
    if (e.key === "1") switchView("timeline");
    if (e.key === "2") switchView("flamegraph");
    if (e.key === "3") switchView("heatmap");
    if (e.key === "f" && !e.ctrlKey && !e.metaKey) {
      switchView(currentView === "flamegraph" ? "timeline" : "flamegraph");
    }
    if (e.key === "h" && !e.ctrlKey && !e.metaKey) {
      switchView(currentView === "heatmap" ? "timeline" : "heatmap");
    }
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
