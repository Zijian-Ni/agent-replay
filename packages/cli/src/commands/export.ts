import { promises as fs } from "node:fs";
import { resolve, basename } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { computeTraceSummary } from "@agent-replay/core";
import type { Trace, Step, TraceSummary } from "@agent-replay/core";
import { loadTrace } from "../utils/loader.js";
import { printBanner, separator } from "../utils/format.js";

interface ExportOptions {
  format?: string;
  output?: string;
}

export async function exportCommand(file: string, options: ExportOptions): Promise<void> {
  printBanner();

  const format = options.format ?? "html";
  if (format !== "html") {
    console.error(chalk.red(`Unsupported export format: ${format}`));
    console.log(chalk.dim("Supported formats: html"));
    process.exit(1);
  }

  const spinner = ora({
    text: chalk.dim("Loading trace..."),
    prefixText: " ",
  }).start();

  let trace: Trace;
  try {
    trace = await loadTrace(file);
    spinner.succeed(chalk.green("Trace loaded"));
  } catch (err) {
    spinner.fail(chalk.red(`Failed to load trace: ${(err as Error).message}`));
    process.exit(1);
  }

  if (!trace.summary) {
    trace.summary = computeTraceSummary(trace);
  }

  const outputFile = options.output ?? resolve(basename(file, ".jsonl") + ".html");

  const exportSpinner = ora({
    text: chalk.dim("Generating HTML..."),
    prefixText: " ",
  }).start();

  try {
    const html = generateHtml(trace);
    await fs.writeFile(outputFile, html, "utf-8");
    exportSpinner.succeed(chalk.green(`Exported to ${outputFile}`));
  } catch (err) {
    exportSpinner.fail(chalk.red(`Failed to export: ${(err as Error).message}`));
    process.exit(1);
  }

  console.log();
  console.log(separator());
  console.log(`  ${chalk.dim("File:")} ${chalk.cyan(outputFile)}`);
  console.log(separator());
  console.log();
}

function generateHtml(trace: Trace): string {
  const summary = trace.summary!;
  const stepsHtml = renderStepsHtml(trace.steps, 0);
  const traceJson = JSON.stringify(trace, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  }, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Replay - ${escapeHtml(trace.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 2rem;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      color: #58a6ff;
      font-size: 1.8rem;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #8b949e;
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card h2 {
      color: #f0f6fc;
      font-size: 1.2rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #21262d;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .meta-item label {
      display: block;
      color: #8b949e;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-item .value {
      color: #f0f6fc;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .steps-list { list-style: none; }
    .step {
      padding: 0.75rem 1rem;
      border-left: 3px solid #30363d;
      margin-bottom: 0.5rem;
      margin-left: 0;
      background: #0d1117;
      border-radius: 0 4px 4px 0;
    }
    .step.llm_call { border-left-color: #58a6ff; }
    .step.tool_call { border-left-color: #3fb950; }
    .step.tool_result { border-left-color: #56d364; }
    .step.decision { border-left-color: #d29922; }
    .step.error { border-left-color: #f85149; }
    .step.custom { border-left-color: #8b949e; }
    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .step-name { font-weight: 600; color: #f0f6fc; }
    .step-type {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 12px;
      background: #21262d;
      color: #8b949e;
    }
    .step-type.llm_call { color: #58a6ff; }
    .step-type.tool_call { color: #3fb950; }
    .step-type.tool_result { color: #56d364; }
    .step-type.decision { color: #d29922; }
    .step-type.error { color: #f85149; }
    .step-meta {
      display: flex;
      gap: 1.5rem;
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: #8b949e;
    }
    .step-children {
      margin-left: 1.5rem;
      margin-top: 0.5rem;
    }
    .step-error {
      color: #f85149;
      font-size: 0.85rem;
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: rgba(248, 81, 73, 0.1);
      border-radius: 4px;
    }
    .step-io {
      margin-top: 0.5rem;
    }
    .step-io summary {
      cursor: pointer;
      color: #8b949e;
      font-size: 0.85rem;
    }
    .step-io pre {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.8rem;
      color: #c9d1d9;
      max-height: 300px;
      overflow-y: auto;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-error { background: rgba(248, 81, 73, 0.2); color: #f85149; }
    .raw-toggle {
      margin-top: 2rem;
      text-align: center;
    }
    .raw-toggle button {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
      padding: 0.5rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .raw-toggle button:hover { background: #30363d; }
    #raw-json {
      display: none;
      margin-top: 1rem;
    }
    #raw-json pre {
      padding: 1rem;
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.8rem;
      max-height: 600px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Agent Replay</h1>
    <p class="subtitle">${escapeHtml(trace.name)}</p>

    <div class="card">
      <h2>Overview</h2>
      <div class="meta-grid">
        <div class="meta-item">
          <label>Trace ID</label>
          <div class="value" style="font-size: 0.85rem; font-family: monospace;">${escapeHtml(trace.id)}</div>
        </div>
        <div class="meta-item">
          <label>Duration</label>
          <div class="value">${formatDurationPlain(trace.duration ?? summary.totalDuration)}</div>
        </div>
        <div class="meta-item">
          <label>Steps</label>
          <div class="value">${summary.totalSteps}</div>
        </div>
        <div class="meta-item">
          <label>Total Tokens</label>
          <div class="value">${summary.totalTokens.total.toLocaleString()}</div>
        </div>
        <div class="meta-item">
          <label>Cost</label>
          <div class="value">$${summary.totalCost.toFixed(4)}</div>
        </div>
        <div class="meta-item">
          <label>Errors</label>
          <div class="value">${summary.errorCount > 0 ? `<span class="badge badge-error">${summary.errorCount}</span>` : "0"}</div>
        </div>
        ${summary.models.length > 0 ? `
        <div class="meta-item">
          <label>Models</label>
          <div class="value" style="font-size: 0.9rem;">${summary.models.map(escapeHtml).join(", ")}</div>
        </div>` : ""}
      </div>
    </div>

    <div class="card">
      <h2>Steps</h2>
      <ul class="steps-list">
        ${stepsHtml}
      </ul>
    </div>

    <div class="raw-toggle">
      <button onclick="toggleRaw()">Show Raw JSON</button>
    </div>
    <div id="raw-json">
      <pre>${escapeHtml(traceJson)}</pre>
    </div>
  </div>

  <script>
    function toggleRaw() {
      const el = document.getElementById('raw-json');
      const btn = document.querySelector('.raw-toggle button');
      if (el.style.display === 'block') {
        el.style.display = 'none';
        btn.textContent = 'Show Raw JSON';
      } else {
        el.style.display = 'block';
        btn.textContent = 'Hide Raw JSON';
      }
    }
  </script>
</body>
</html>`;
}

function renderStepsHtml(steps: Step[], depth: number): string {
  return steps.map((step) => {
    const meta: string[] = [];
    if (step.duration !== undefined) meta.push(formatDurationPlain(step.duration));
    if (step.model) meta.push(step.model);
    if (step.tokens) meta.push(`${step.tokens.total.toLocaleString()} tokens`);
    if (step.cost) meta.push(`$${step.cost.toFixed(4)}`);

    const errorHtml = step.error
      ? `<div class="step-error">${escapeHtml(step.error.message)}</div>`
      : "";

    const inputStr = step.input !== undefined ? JSON.stringify(step.input, null, 2) : "";
    const outputStr = step.output !== undefined ? JSON.stringify(step.output, null, 2) : "";

    const ioHtml = (inputStr || outputStr) ? `
      <div class="step-io">
        ${inputStr ? `<details><summary>Input</summary><pre>${escapeHtml(inputStr)}</pre></details>` : ""}
        ${outputStr ? `<details><summary>Output</summary><pre>${escapeHtml(outputStr)}</pre></details>` : ""}
      </div>` : "";

    const childrenHtml = step.children.length > 0
      ? `<div class="step-children"><ul class="steps-list">${renderStepsHtml(step.children, depth + 1)}</ul></div>`
      : "";

    return `
      <li class="step ${step.type}">
        <div class="step-header">
          <span class="step-name">${escapeHtml(step.name)}</span>
          <span class="step-type ${step.type}">${step.type}</span>
        </div>
        ${meta.length > 0 ? `<div class="step-meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}</div>` : ""}
        ${errorHtml}
        ${ioHtml}
        ${childrenHtml}
      </li>`;
  }).join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDurationPlain(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = ((ms % 60_000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}
