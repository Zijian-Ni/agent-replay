# Custom Agent Example

Demonstrates advanced Agent Replay features using a custom agent with manual step recording, no external LLM API required.

## Prerequisites

- Node.js >= 20

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm start
```

No API keys are required. This example uses simulated tools to demonstrate the recording API.

## What This Shows

### Manual Step Recording

Use `startStep()` and `endStep()` to record any operation:

```ts
const stepId = recorder.startStep("tool_call", "my-operation", inputData);
// ... do work ...
recorder.endStep(stepId, outputData, { metadata: { key: "value" } });
```

### Nested Steps

Pass a `parentId` to create parent-child relationships:

```ts
const parentId = recorder.startStep("decision", "planning", input);
const childId = recorder.startStep("custom", "sub-task", childInput, parentId);
recorder.endStep(childId, childOutput);
recorder.endStep(parentId, parentOutput);
```

### interceptFunction

Wrap any async function for automatic recording:

```ts
const trackedSearch = interceptFunction(searchDatabase, recorder, {
  name: "searchDatabase",
  type: "tool_call",
});
const results = await trackedSearch("query"); // Automatically recorded
```

### Error Handling

Errors in recorded steps are captured without disrupting the trace:

```ts
const stepId = recorder.startStep("tool_call", "risky-op", input);
try {
  const result = await riskyOperation();
  recorder.endStep(stepId, result);
} catch (err) {
  recorder.endStep(stepId, null, {
    error: { message: err.message, stack: err.stack },
  });
}
```

### Trace Comparison

Run two sessions and compare them:

```ts
const diff = diffTraces(traceA, traceB);
console.log(`Steps added: ${diff.added.length}`);
console.log(`Cost diff: $${diff.summary.costDiff}`);
```

### Anomaly Detection

Flag slow steps, high costs, and repeated errors:

```ts
const anomalies = detectAnomalies(trace, {
  slowStepMs: 100,
  highCostUsd: 0.01,
});
```
