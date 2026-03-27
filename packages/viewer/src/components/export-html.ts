/**
 * Export as shareable HTML — generates a self-contained HTML file
 * with all trace data and a minimal viewer embedded.
 */

interface ExportStep {
  id: string;
  type: string;
  name: string;
  duration?: number;
  tokens?: { prompt: number; completion: number; total: number };
  cost?: number;
  model?: string;
  error?: { message: string };
  children: ExportStep[];
  input: unknown;
  output?: unknown;
}

interface ExportTrace {
  id: string;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  steps: ExportStep[];
  summary?: {
    totalSteps: number;
    totalTokens: { total: number };
    totalCost: number;
    models: string[];
    errorCount: number;
  };
}

function escapeHtmlAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function exportTraceAsHtml(trace: ExportTrace): string {
  const traceJson = JSON.stringify(trace, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Replay — ${escapeHtmlAttr(trace.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; padding: 2rem; }
  .header { margin-bottom: 2rem; }
  .header h1 { font-size: 1.5rem; color: #58a6ff; margin-bottom: 0.5rem; }
  .header .meta { font-size: 0.85rem; color: #8b949e; display: flex; gap: 1rem; flex-wrap: wrap; }
  .step { border-left: 2px solid #30363d; padding: 0.75rem 1rem; margin: 0.25rem 0; position: relative; cursor: pointer; transition: background 0.15s; border-radius: 0 6px 6px 0; }
  .step:hover { background: #161b22; }
  .step.selected { background: #1c2128; border-left-color: #58a6ff; }
  .step-header { display: flex; align-items: center; gap: 0.5rem; }
  .badge { font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 3px; text-transform: uppercase; }
  .badge-llm_call { background: #1e3a5f; color: #58a6ff; }
  .badge-tool_call { background: #1a3a2a; color: #3fb950; }
  .badge-tool_result { background: #1a3a2a; color: #56d364; }
  .badge-error { background: #3d1a1a; color: #f85149; }
  .badge-decision { background: #3d3a1a; color: #d29922; }
  .badge-custom { background: #2a1a3d; color: #a371f7; }
  .step-name { font-weight: 500; }
  .step-meta { font-size: 0.8rem; color: #8b949e; margin-top: 4px; display: flex; gap: 0.75rem; }
  .children { margin-left: 1.25rem; }
  .inspector { position: fixed; right: 0; top: 0; width: 400px; height: 100vh; background: #161b22; border-left: 1px solid #30363d; padding: 1rem; overflow: auto; transform: translateX(100%); transition: transform 0.2s; }
  .inspector.open { transform: translateX(0); }
  .inspector h3 { margin-bottom: 1rem; color: #58a6ff; }
  .inspector pre { font-size: 0.8rem; white-space: pre-wrap; word-break: break-all; background: #0d1117; padding: 0.75rem; border-radius: 6px; }
  .inspector .close { position: absolute; top: 0.5rem; right: 0.5rem; background: none; border: none; color: #8b949e; cursor: pointer; font-size: 1.2rem; }
  .error-text { color: #f85149; font-size: 0.8rem; margin-top: 4px; }
  @media (max-width: 768px) { .inspector { width: 100vw; } body { padding: 1rem; } }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtmlAttr(trace.name)}</h1>
  <div class="meta">
    <span>${trace.summary?.totalSteps ?? 0} steps</span>
    <span>${trace.duration != null ? (trace.duration < 1000 ? trace.duration + 'ms' : (trace.duration / 1000).toFixed(1) + 's') : '--'}</span>
    ${trace.summary?.totalCost ? `<span>$${trace.summary.totalCost.toFixed(4)}</span>` : ''}
    ${trace.summary?.models?.length ? `<span>${trace.summary.models.join(', ')}</span>` : ''}
    ${trace.summary?.errorCount ? `<span style="color:#f85149">${trace.summary.errorCount} errors</span>` : ''}
    <span style="color:#8b949e">Exported from Agent Replay</span>
  </div>
</div>
<div id="steps"></div>
<div class="inspector" id="inspector">
  <button class="close" onclick="document.getElementById('inspector').classList.remove('open')">&times;</button>
  <h3 id="inspector-title">Step Details</h3>
  <pre id="inspector-content"></pre>
</div>
<script>
const trace = ${traceJson};
function renderSteps(steps, container, depth) {
  for (const step of steps) {
    const el = document.createElement('div');
    el.className = 'step';
    el.style.marginLeft = (depth * 20) + 'px';
    el.innerHTML = '<div class="step-header"><span class="badge badge-' + step.type + '">' + step.type.replace('_',' ') + '</span><span class="step-name">' + esc(step.name) + '</span>' + (step.model ? '<span style="color:#8b949e;font-size:0.8rem">' + esc(step.model) + '</span>' : '') + '</div><div class="step-meta">' + (step.duration != null ? '<span>' + step.duration + 'ms</span>' : '') + (step.tokens ? '<span>' + step.tokens.total + ' tok</span>' : '') + (step.cost ? '<span>$' + step.cost.toFixed(4) + '</span>' : '') + '</div>' + (step.error ? '<div class="error-text">' + esc(step.error.message) + '</div>' : '');
    el.addEventListener('click', function(e) { e.stopPropagation(); showInspector(step); });
    container.appendChild(el);
    if (step.children && step.children.length > 0) renderSteps(step.children, container, depth + 1);
  }
}
function showInspector(step) {
  document.getElementById('inspector-title').textContent = step.name;
  document.getElementById('inspector-content').textContent = JSON.stringify(step, null, 2);
  document.getElementById('inspector').classList.add('open');
  document.querySelectorAll('.step').forEach(s => s.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
renderSteps(trace.steps, document.getElementById('steps'), 0);
</script>
</body>
</html>`;
}

export function downloadHtml(trace: ExportTrace): void {
  const html = exportTraceAsHtml(trace);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trace.name.replace(/[^a-z0-9]/gi, "-")}-trace.html`;
  a.click();
  URL.revokeObjectURL(url);
}
