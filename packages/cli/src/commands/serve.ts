import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import { join, resolve, extname } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { printBanner, separator } from "../utils/format.js";

interface ServeOptions {
  port?: string;
  dir?: string;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jsonl": "application/jsonlines",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

export async function serveCommand(options: ServeOptions): Promise<void> {
  printBanner();

  const port = parseInt(options.port ?? "3000", 10);
  const traceDir = resolve(options.dir ?? "./traces");

  console.log(chalk.bold("  Starting Agent Replay Server"));
  console.log(separator());
  console.log(`  ${chalk.dim("Port:")}      ${chalk.cyan(String(port))}`);
  console.log(`  ${chalk.dim("Traces:")}    ${chalk.dim(traceDir)}`);
  console.log(separator());

  const spinner = ora({
    text: chalk.dim("Starting server..."),
    prefixText: " ",
  }).start();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // API: List traces
    if (pathname === "/api/traces") {
      try {
        const files = await fs.readdir(traceDir);
        const traceFiles = files.filter(
          (f) => f.endsWith(".jsonl") || f.endsWith(".jsonl.gz"),
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ traces: traceFiles }));
      } catch {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ traces: [] }));
      }
      return;
    }

    // API: Get trace content
    if (pathname.startsWith("/api/traces/")) {
      const traceFile = decodeURIComponent(pathname.slice("/api/traces/".length));
      // Prevent directory traversal
      if (traceFile.includes("..") || traceFile.includes("/")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid trace file name" }));
        return;
      }
      try {
        const content = await fs.readFile(join(traceDir, traceFile), "utf-8");
        res.writeHead(200, { "Content-Type": "application/jsonlines" });
        res.end(content);
      } catch {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Trace not found" }));
      }
      return;
    }

    // Serve viewer HTML for root
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(getViewerHtml(port));
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(port, () => {
    spinner.succeed(chalk.green("Server started"));
    console.log();
    console.log(`  ${chalk.bold("Viewer:")}    ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log(`  ${chalk.bold("API:")}       ${chalk.cyan(`http://localhost:${port}/api/traces`)}`);
    console.log();
    console.log(chalk.dim("  Press Ctrl+C to stop"));
    console.log();
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log();
    console.log(chalk.dim("  Shutting down..."));
    server.close();
    process.exit(0);
  });
}

function getViewerHtml(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Replay — Live Viewer</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #0d1117; color: #c9d1d9; }
    h1 { color: #58a6ff; }
    .trace-list { list-style: none; padding: 0; }
    .trace-item { padding: 0.75rem 1rem; margin: 0.25rem 0; background: #161b22; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; }
    .trace-item:hover { border-color: #58a6ff; }
    .trace-content { margin-top: 1rem; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; white-space: pre-wrap; font-family: monospace; font-size: 0.85rem; max-height: 70vh; overflow: auto; }
    .loading { color: #8b949e; }
  </style>
</head>
<body>
  <h1>Agent Replay — Live Viewer</h1>
  <p class="loading" id="status">Loading traces...</p>
  <ul class="trace-list" id="trace-list"></ul>
  <div class="trace-content" id="trace-content" hidden></div>
  <script>
    async function loadTraces() {
      const res = await fetch('/api/traces');
      const data = await res.json();
      const list = document.getElementById('trace-list');
      const status = document.getElementById('status');
      if (data.traces.length === 0) {
        status.textContent = 'No traces found. Record some agent traces first.';
        return;
      }
      status.textContent = data.traces.length + ' trace(s) found:';
      list.innerHTML = data.traces.map(t =>
        '<li class="trace-item" onclick="loadTrace(\\'' + t + '\\')">' + t + '</li>'
      ).join('');
    }
    async function loadTrace(name) {
      const content = document.getElementById('trace-content');
      content.hidden = false;
      content.textContent = 'Loading...';
      const res = await fetch('/api/traces/' + encodeURIComponent(name));
      const text = await res.text();
      try {
        const lines = text.trim().split('\\n').map(l => JSON.parse(l));
        content.textContent = JSON.stringify(lines, null, 2);
      } catch { content.textContent = text; }
    }
    loadTraces();
  </script>
</body>
</html>`;
}
