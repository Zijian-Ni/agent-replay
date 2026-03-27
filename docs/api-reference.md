# API Reference

Complete API documentation for `@agent-replay/core`.

## AgentRecorder

Records AI agent execution traces.

### Constructor

```ts
new AgentRecorder(options: RecorderOptions)
```

**RecorderOptions:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | *required* | Name for this trace |
| `storage` | `"file" \| "sqlite" \| "memory"` | `undefined` | Storage backend. If omitted, trace is kept in memory only. |
| `outputDir` | `string` | `"./traces"` | Directory for file storage, or DB path for SQLite |
| `redact` | `boolean` | `true` | Whether to auto-redact sensitive data |
| `redactPatterns` | `RegExp[]` | `[]` | Additional custom redaction patterns |
| `encrypt` | `boolean` | `false` | Whether to encrypt traces at rest |
| `encryptionKey` | `string` | `undefined` | Encryption key (required if `encrypt` is `true`) |
| `metadata` | `Record<string, unknown>` | `{}` | Additional metadata to attach to the trace |

### Properties

#### `traceId: string`

The UUID of the current trace (read-only).

### Methods

#### `startStep(type, name, input, parentId?): StepId`

Start recording a new step. Returns the step ID.

```ts
const stepId = recorder.startStep("llm_call", "chat-completion", {
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `StepType` | One of: `"llm_call"`, `"tool_call"`, `"tool_result"`, `"decision"`, `"error"`, `"custom"` |
| `name` | `string` | Human-readable name for the step |
| `input` | `unknown` | Input data (will be redacted if redaction is enabled) |
| `parentId` | `StepId` | Optional parent step ID for nesting |

#### `endStep(stepId, output, extra?): void`

End a previously started step with its output.

```ts
recorder.endStep(stepId, response, {
  tokens: { prompt: 100, completion: 50, total: 150 },
  cost: 0.002,
  model: "gpt-4o",
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `stepId` | `StepId` | The step ID returned by `startStep` |
| `output` | `unknown` | Output data (will be redacted if redaction is enabled) |
| `extra.tokens` | `TokenUsage` | Token counts: `{ prompt, completion, total }` |
| `extra.cost` | `number` | Cost in USD |
| `extra.model` | `string` | Model identifier |
| `extra.error` | `{ message, stack? }` | Error information if the step failed |
| `extra.metadata` | `Record<string, unknown>` | Additional step metadata |

#### `addStep(type, name, input, output, extra?): StepId`

Record a complete step in a single call (calls `startStep` + `endStep` internally).

```ts
recorder.addStep("tool_call", "web-search", { query: "AI news" }, { results: [...] }, {
  duration: 1200,
  metadata: { source: "google" },
});
```

The `extra` parameter accepts all fields from `endStep` plus:

| Parameter | Type | Description |
|-----------|------|-------------|
| `extra.parentId` | `StepId` | Parent step ID for nesting |
| `extra.duration` | `number` | Override the computed duration (ms) |

#### `intercept<T>(client: T): T`

Create a generic proxy-based interceptor for any object. All method calls on the returned proxy are recorded as `tool_call` steps.

```ts
const trackedClient = recorder.intercept(myApiClient);
```

#### `stop(): Promise<Trace>`

Stop recording, compute the summary, persist the trace to storage, and return the finalized `Trace` object.

```ts
const trace = await recorder.stop();
console.log(trace.summary?.totalCost);
```

#### `getTrace(): Trace`

Get the current trace object (may be incomplete if recording has not stopped).

---

## AgentReplayer

Replays recorded traces step-by-step.

### Constructor

```ts
new AgentReplayer(trace: Trace | SerializedTrace, options?: ReplayerOptions)
```

**ReplayerOptions:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `mock` | `boolean` | `false` | Whether to use recorded responses instead of real API calls |
| `speed` | `number` | `undefined` | Playback speed multiplier. If set, delays between steps are simulated at `duration / speed`. |
| `onStep` | `(step: Step, index: number) => void \| Promise<void>` | `undefined` | Callback invoked for each step during replay |

### Properties

#### `totalSteps: number`

Total number of flattened steps in the trace.

#### `currentStepIndex: number`

Current position in the step sequence.

### Methods

#### `next(): Promise<Step | null>`

Advance to the next step. Returns the step, or `null` if no more steps remain. Invokes the `onStep` callback if configured, and applies timing delay if `speed` is set.

#### `seek(index: number): Step | undefined`

Jump to a specific step index. Returns the step at that index, or `undefined` if the index is out of bounds.

#### `reset(): void`

Reset the replay position to the beginning.

#### `hasNext(): boolean`

Returns `true` if there are more steps to replay.

#### `replayAll(): Promise<Step[]>`

Replay all remaining steps from the current position. Returns all replayed steps.

#### `fork(modifications?): AgentReplayer`

Fork the trace from the current position, creating a new `AgentReplayer` with steps up to (but not including) the current index. Optionally apply modifications to steps.

```ts
// Fork at step 5 and modify a step
replayer.seek(5);
const forked = replayer.fork({
  steps: [{ id: "step-uuid", model: "gpt-4o-mini" }],
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `modifications.steps` | `Partial<Step>[]` | Partial step objects to merge (matched by `id`) |

#### `getTrace(): Trace`

Get the full trace object.

#### `getStep(index: number): Step | undefined`

Get a step at a specific index without moving the replay position.

#### `getCurrentStep(): Step | undefined`

Get the step at the current replay position without advancing.

---

## Storage

### TraceStorage Interface

All storage backends implement this interface:

```ts
interface TraceStorage {
  save(trace: SerializedTrace): Promise<void>;
  load(id: TraceId): Promise<SerializedTrace | null>;
  list(): Promise<TraceId[]>;
  delete(id: TraceId): Promise<void>;
  search(query: string): Promise<SerializedTrace[]>;
}
```

### JsonlStorage

JSONL file-based storage. Each trace is saved as a `<trace-id>.jsonl` file.

```ts
import { JsonlStorage } from "@agent-replay/core";

const storage = new JsonlStorage("./my-traces"); // default: "./traces"
await storage.save(serializedTrace);
const trace = await storage.load("trace-id");
const ids = await storage.list();
const results = await storage.search("my-agent");
await storage.delete("trace-id");
```

### MemoryStorage

In-memory storage backed by a `Map`. Useful for testing.

```ts
import { MemoryStorage } from "@agent-replay/core";

const storage = new MemoryStorage();
await storage.save(serializedTrace);
storage.size;    // number of stored traces
storage.clear(); // remove all traces
```

### SqliteStorage

SQLite-based storage. Requires `better-sqlite3` as a peer dependency.

```ts
import { SqliteStorage } from "@agent-replay/core";

const storage = new SqliteStorage("./traces.db"); // default: "traces.db"
await storage.save(serializedTrace);
storage.close(); // close the database connection
```

### createStorage Factory

```ts
import { createStorage } from "@agent-replay/core";

const storage = createStorage("file", "./traces");    // JsonlStorage
const storage = createStorage("sqlite", "./traces.db"); // SqliteStorage
const storage = createStorage("memory");                // MemoryStorage
```

---

## Interceptors

### interceptOpenAI

```ts
function interceptOpenAI<T extends object>(client: T, recorder: AgentRecorder): T
```

Wraps an OpenAI SDK client. All `.create()` calls are recorded as `llm_call` steps with token usage and cost automatically extracted.

```ts
import OpenAI from "openai";
import { AgentRecorder, interceptOpenAI } from "@agent-replay/core";

const recorder = new AgentRecorder({ name: "my-trace" });
const openai = interceptOpenAI(new OpenAI(), recorder);
```

### interceptAnthropic

```ts
function interceptAnthropic<T extends object>(client: T, recorder: AgentRecorder): T
```

Wraps an Anthropic SDK client. All `.create()` calls on `messages` are recorded as `llm_call` steps with token usage and cost.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { AgentRecorder, interceptAnthropic } from "@agent-replay/core";

const recorder = new AgentRecorder({ name: "my-trace" });
const anthropic = interceptAnthropic(new Anthropic(), recorder);
```

### interceptFunction

```ts
function interceptFunction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  recorder: AgentRecorder,
  options?: { name?: string; type?: StepType }
): (...args: TArgs) => Promise<TReturn>
```

Wraps any function (sync or async) to record its calls as steps.

```ts
import { AgentRecorder, interceptFunction } from "@agent-replay/core";

async function myTool(query: string): Promise<string[]> { /* ... */ }

const recorder = new AgentRecorder({ name: "my-trace" });
const trackedTool = interceptFunction(myTool, recorder, {
  name: "myTool",
  type: "tool_call",
});

const results = await trackedTool("search query");
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `fn.name` or `"anonymous"` | Step name for recording |
| `type` | `StepType` | `"tool_call"` | Step type |

---

## Analysis Functions

### analyzeCost

```ts
function analyzeCost(trace: Trace): CostBreakdown
```

Returns a cost breakdown for the trace.

**CostBreakdown:**

```ts
interface CostBreakdown {
  byModel: Record<string, {
    tokens: TokenUsage;
    cost: number;
    calls: number;
  }>;
  byStepType: Record<string, {
    cost: number;
    count: number;
  }>;
  total: number;
}
```

### diffTraces

```ts
function diffTraces(traceA: Trace, traceB: Trace): TraceDiff
```

Compares two traces and returns their differences.

**TraceDiff:**

```ts
interface TraceDiff {
  added: Step[];     // Steps in B but not A
  removed: Step[];   // Steps in A but not B
  modified: Array<{
    before: Step;
    after: Step;
    changes: string[];  // e.g., ["duration: 100ms -> 200ms", "output changed"]
  }>;
  summary: {
    tokenDiff: number;
    costDiff: number;
    durationDiff: number;
    stepCountDiff: number;
  };
}
```

### generateTimeline

```ts
function generateTimeline(trace: Trace): TimelineEntry[]
```

Produces a flat, sorted list of timeline entries for visualization.

**TimelineEntry:**

```ts
interface TimelineEntry {
  step: Step;
  depth: number;          // Nesting depth (0 = top-level)
  startOffset: number;    // Milliseconds from trace start
  endOffset: number;      // Milliseconds from trace start
  percentOfTotal: number; // Percentage of total trace duration
}
```

### detectAnomalies

```ts
function detectAnomalies(trace: Trace, thresholds?: {
  slowStepMs?: number;           // default: 30000
  highCostUsd?: number;          // default: 0.5
  tokenSpikeMultiplier?: number; // default: 3
}): Anomaly[]
```

Detects anomalies in a trace.

**Anomaly types:**

| Type | Trigger | Severity |
|------|---------|----------|
| `slow_step` | Step duration exceeds threshold | `medium` (or `high` if > 3x threshold) |
| `high_cost` | Step cost exceeds threshold | `medium` (or `high` if > 5x threshold) |
| `token_spike` | Token count exceeds average * multiplier | `low` (or `high` if > 2x spike) |
| `error_rate` | More than 20% of steps have errors | `high` |
| `repeated_error` | Same error message appears 3+ times | `medium` (or `high` if 5+ times) |

**Anomaly:**

```ts
interface Anomaly {
  type: "slow_step" | "high_cost" | "error_rate" | "token_spike" | "repeated_error";
  severity: "low" | "medium" | "high";
  message: string;
  stepId?: StepId;
  details: Record<string, unknown>;
}
```

---

## Type Definitions

### Core Types

```ts
type TraceId = string;
type StepId = string;
type StepType = "llm_call" | "tool_call" | "tool_result" | "decision" | "error" | "custom";
```

### TokenUsage

```ts
interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}
```

### StepError

```ts
interface StepError {
  message: string;
  stack?: string;
  code?: string;
}
```

### Step

```ts
interface Step {
  id: StepId;
  parentId?: StepId;
  type: StepType;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  input: unknown;
  output?: unknown;
  tokens?: TokenUsage;
  cost?: number;
  model?: string;
  error?: StepError;
  children: Step[];
  metadata?: Record<string, unknown>;
}
```

### Trace

```ts
interface Trace {
  id: TraceId;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  steps: Step[];
  metadata: Record<string, unknown>;
  summary?: TraceSummary;
}
```

### TraceSummary

```ts
interface TraceSummary {
  totalSteps: number;
  totalTokens: TokenUsage;
  totalCost: number;
  totalDuration: number;
  stepsByType: Record<StepType, number>;
  models: string[];
  errorCount: number;
}
```

### RedactionRule

```ts
interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}
```

### Interceptor

```ts
interface Interceptor<T> {
  wrap(target: T): T;
  unwrap(): T;
}
```

### Serialized Types

`SerializedStep` and `SerializedTrace` mirror `Step` and `Trace` but use ISO 8601 strings instead of `Date` objects for `startedAt` and `endedAt`. These are the types used in storage and JSON serialization.
