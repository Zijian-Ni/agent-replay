# OpenAI Chat Example

A simple example showing how to record OpenAI chat completion calls with Agent Replay.

## Prerequisites

- Node.js >= 20
- An OpenAI API key

## Setup

```bash
# Install dependencies
pnpm install

# Set your API key
export OPENAI_API_KEY="sk-..."
```

## Run

```bash
pnpm start
```

This will:

1. Create an `AgentRecorder` with JSONL file storage
2. Wrap the OpenAI client with `interceptOpenAI` to automatically capture all API calls
3. Make two chat completion requests (a question and a follow-up)
4. Print a summary of the recorded trace including token usage and cost
5. Save the trace to `./traces/<trace-id>.jsonl`

## Viewing the Trace

After running the example, you can view the trace with the CLI:

```bash
npx @agent-replay/cli view ./traces/<trace-id>.jsonl
```

Or open it in the web viewer:

```bash
npx @agent-replay/cli serve ./traces/
```
