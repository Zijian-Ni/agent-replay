# Anthropic Agent Example

Demonstrates recording an Anthropic Claude agent that uses tools in a multi-turn conversation loop.

## Prerequisites

- Node.js >= 20
- An Anthropic API key

## Setup

```bash
# Install dependencies
pnpm install

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Run

```bash
pnpm start
```

This will:

1. Create an `AgentRecorder` with JSONL file storage
2. Wrap the Anthropic client with `interceptAnthropic`
3. Run a multi-turn agent loop where Claude calls `get_weather` and `get_time` tools
4. Record both the LLM calls (automatically via interceptor) and tool executions (manually via `startStep`/`endStep`)
5. Analyze cost breakdown by model and step type
6. Run anomaly detection on the trace
7. Save the trace to `./traces/<trace-id>.jsonl`

## What This Shows

- **Automatic LLM call recording**: The `interceptAnthropic` wrapper captures all `messages.create` calls, including token usage and cost.
- **Manual tool recording**: Tool executions are recorded with `recorder.startStep()` and `recorder.endStep()` to capture inputs and outputs.
- **Cost analysis**: `analyzeCost()` breaks down spending by model and step type.
- **Anomaly detection**: `detectAnomalies()` flags slow steps, high costs, token spikes, and repeated errors.
