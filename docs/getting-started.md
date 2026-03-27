# Getting Started

Agent Replay is a toolkit for recording, replaying, and analyzing AI agent execution traces. It captures every LLM call, tool invocation, and decision your agent makes, then lets you inspect, compare, and debug those sessions.

## Installation

Install the core package:

```bash
# npm
npm install @agent-replay/core

# pnpm
pnpm add @agent-replay/core

# yarn
yarn add @agent-replay/core
```

Optionally install the CLI for viewing traces in the terminal:

```bash
npm install -g @agent-replay/cli
```

## Quick Start

### 1. Record a trace

```ts
import OpenAI from "openai";
import { AgentRecorder, interceptOpenAI } from "@agent-replay/core";

// Create a recorder with file-based storage
const recorder = new AgentRecorder({
  name: "my-agent-session",
  storage: "file",
  outputDir: "./traces",
});

// Wrap the OpenAI client to auto-record all API calls
const openai = interceptOpenAI(new OpenAI(), recorder);

// Use the client as normal — all calls are recorded
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});

// Finalize and save the trace
const trace = await recorder.stop();
console.log(`Trace saved: ${trace.id}`);
```

### 2. Replay a trace

```ts
import { AgentReplayer, JsonlStorage } from "@agent-replay/core";

// Load a trace from storage
const storage = new JsonlStorage("./traces");
const serializedTrace = await storage.load("your-trace-id");

// Create a replayer
const replayer = new AgentReplayer(serializedTrace, {
  onStep: (step, index) => {
    console.log(`Step ${index}: [${step.type}] ${step.name}`);
  },
});

// Step through one at a time
while (replayer.hasNext()) {
  const step = await replayer.next();
  console.log(`  Input:  ${JSON.stringify(step?.input)}`);
  console.log(`  Output: ${JSON.stringify(step?.output)}`);
}
```

### 3. View a trace with the CLI

```bash
# View a summary in the terminal
agent-replay view ./traces/<trace-id>.jsonl

# Compare two traces
agent-replay diff ./traces/trace-a.jsonl ./traces/trace-b.jsonl

# Show statistics
agent-replay stats ./traces/<trace-id>.jsonl
```

### 4. Analyze a trace

```ts
import { analyzeCost, detectAnomalies, generateTimeline, diffTraces } from "@agent-replay/core";

// Cost breakdown by model and step type
const cost = analyzeCost(trace);
console.log(`Total cost: $${cost.total.toFixed(4)}`);

// Find performance issues
const anomalies = detectAnomalies(trace, {
  slowStepMs: 5000,
  highCostUsd: 0.10,
});

// Generate a timeline for visualization
const timeline = generateTimeline(trace);

// Compare two runs
const diff = diffTraces(traceA, traceB);
console.log(`Cost difference: $${diff.summary.costDiff.toFixed(4)}`);
```

## Next Steps

- [Architecture](./architecture.md) — understand how the system is designed
- [API Reference](./api-reference.md) — full API documentation
- [Interceptors](./interceptors.md) — auto-record OpenAI, Anthropic, or custom functions
- [Security](./security.md) — redaction and encryption
- [Viewer](./viewer.md) — web-based trace viewer
