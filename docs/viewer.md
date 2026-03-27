# Viewer

The Agent Replay viewer is a web-based interface for exploring and debugging trace files. It provides a visual representation of agent execution with step trees, timelines, and detailed inspection.

## Quick Start

### Using the CLI

The simplest way to open the viewer is through the CLI:

```bash
# Serve the viewer with a trace directory
npx @agent-replay/cli serve ./traces/

# View a specific trace file directly in the terminal
npx @agent-replay/cli view ./traces/<trace-id>.jsonl
```

### Standalone Viewer

The viewer is a Vite-based web application in the `packages/viewer` package. To run it in development:

```bash
cd packages/viewer
pnpm install
pnpm dev
```

This starts the viewer at `http://localhost:5173` by default.

## Loading Traces

### From the File System

Drag and drop a `.jsonl` or `.json` trace file onto the viewer, or use the file picker to browse your local file system.

### From a URL

Pass a trace URL as a query parameter:

```
http://localhost:5173/?trace=https://example.com/traces/abc123.jsonl
```

### From the CLI

The `serve` command starts a local server that makes traces in a directory available to the viewer:

```bash
npx @agent-replay/cli serve ./traces/ --port 3000
```

## Features

### Step Tree View

The main panel shows the trace as a tree of steps. Each step displays:

- **Type badge**: color-coded by step type (`llm_call`, `tool_call`, `decision`, etc.)
- **Name**: the step name
- **Duration**: how long the step took
- **Token count**: for LLM calls
- **Cost**: estimated USD cost
- **Error indicator**: red highlight for steps with errors

Click a step to expand it and see its children. Nested steps are indented to show the parent-child hierarchy.

### Step Detail Panel

Clicking a step opens a detail panel showing:

- **Input**: the full input data (formatted JSON)
- **Output**: the full output data (formatted JSON)
- **Timing**: start time, end time, duration
- **Tokens**: prompt, completion, and total token counts
- **Cost**: estimated cost in USD
- **Model**: the LLM model used
- **Error**: error message and stack trace (if applicable)
- **Metadata**: any custom metadata attached to the step

### Timeline View

A horizontal timeline visualization showing:

- Steps as bars proportional to their duration
- Nesting depth indicated by vertical position
- Color coding by step type
- Hover tooltips with step details

### Summary Dashboard

An overview panel showing aggregate statistics:

- Total steps, tokens, cost, and duration
- Steps by type (bar chart)
- Models used
- Error count and error rate

### Trace Comparison

Load two traces side-by-side to compare:

- Step-by-step diff highlighting added, removed, and modified steps
- Summary delta showing changes in tokens, cost, and duration

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `Down Arrow` | Move to next step |
| `k` / `Up Arrow` | Move to previous step |
| `Enter` | Expand/collapse selected step |
| `Space` | Toggle detail panel |
| `t` | Switch to timeline view |
| `s` | Switch to step tree view |
| `d` | Switch to dashboard view |
| `?` | Show keyboard shortcuts help |
| `Escape` | Close detail panel / deselect |

## Deploying the Viewer

### Static Build

Build the viewer as a static site:

```bash
cd packages/viewer
pnpm build
```

The output in `dist/` can be deployed to any static hosting service (Netlify, Vercel, GitHub Pages, S3, etc.).

### Configuration

The viewer can be configured via environment variables during build:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` | Base URL for a trace-serving API |
| `VITE_DEFAULT_TRACE_DIR` | `"./traces"` | Default directory to load traces from |

### Docker

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY packages/viewer ./
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

### Behind a Reverse Proxy

The viewer is a single-page application. Configure your reverse proxy to serve `index.html` for all routes:

**Nginx:**

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Caddy:**

```
try_files {path} /index.html
```
