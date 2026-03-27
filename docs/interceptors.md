# Interceptors

Interceptors are proxy-based wrappers that automatically record SDK calls without requiring any changes to your application code. Agent Replay provides built-in interceptors for OpenAI and Anthropic, plus a generic `interceptFunction` for wrapping any function.

## How Interceptors Work

Interceptors use JavaScript `Proxy` objects to transparently wrap SDK clients. When you call a method on an intercepted client, the proxy:

1. Calls `recorder.startStep()` to begin recording
2. Forwards the call to the original SDK client
3. Waits for the response (handling both sync and async returns)
4. Extracts token usage and calculates cost from the response
5. Calls `recorder.endStep()` with the output, tokens, cost, and model
6. Returns the original response to your code unchanged

The proxy is recursive: accessing nested properties (like `openai.chat.completions`) returns new proxies, so the interception works at any depth in the SDK's method chain.

## interceptOpenAI

Wraps an OpenAI SDK client to record all `.create()` calls.

### Usage

```ts
import OpenAI from "openai";
import { AgentRecorder, interceptOpenAI } from "@agent-replay/core";

const recorder = new AgentRecorder({ name: "my-session" });
const openai = interceptOpenAI(new OpenAI(), recorder);

// These calls are automatically recorded:
const chat = await openai.chat.completions.create({ ... });
const embedding = await openai.embeddings.create({ ... });
const image = await openai.images.generate({ ... });
```

### What Gets Recorded

For each `.create()` call, the interceptor records:

| Field | Source |
|-------|--------|
| `type` | `"llm_call"` |
| `name` | Full method path, e.g. `"openai.chat.completions.create"` |
| `input` | The request parameters (first argument to `.create()`) |
| `output` | The full API response |
| `model` | Extracted from `input.model` |
| `tokens` | Extracted from `response.usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`) |
| `cost` | Calculated from tokens and built-in pricing table |

### Pricing Table

Costs are estimated using the following per-1M-token rates:

| Model | Prompt | Completion |
|-------|--------|------------|
| `gpt-4` | $30.00 | $60.00 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4o` | $5.00 | $15.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |

If the model is not in the table, `cost` will be `undefined` in the recorded step. Token usage is still captured.

## interceptAnthropic

Wraps an Anthropic SDK client to record all `.create()` calls.

### Usage

```ts
import Anthropic from "@anthropic-ai/sdk";
import { AgentRecorder, interceptAnthropic } from "@agent-replay/core";

const recorder = new AgentRecorder({ name: "my-session" });
const anthropic = interceptAnthropic(new Anthropic(), recorder);

// Automatically recorded:
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});
```

### What Gets Recorded

| Field | Source |
|-------|--------|
| `type` | `"llm_call"` |
| `name` | Full method path, e.g. `"anthropic.messages.create"` |
| `input` | The request parameters |
| `output` | The full API response |
| `model` | Extracted from `input.model` |
| `tokens` | Extracted from `response.usage` (`input_tokens`, `output_tokens`) |
| `cost` | Calculated from tokens and built-in pricing table |

### Pricing Table

| Model | Prompt (per 1M) | Completion (per 1M) |
|-------|-----------------|---------------------|
| `claude-3-opus-20240229` | $15.00 | $75.00 |
| `claude-3-sonnet-20240229` | $3.00 | $15.00 |
| `claude-3-haiku-20240307` | $0.25 | $1.25 |
| `claude-3-5-sonnet-20241022` | $3.00 | $15.00 |
| `claude-opus-4-20250514` | $15.00 | $75.00 |
| `claude-sonnet-4-20250514` | $3.00 | $15.00 |

## interceptFunction

Wraps any synchronous or asynchronous function to record its calls.

### Usage

```ts
import { AgentRecorder, interceptFunction } from "@agent-replay/core";

const recorder = new AgentRecorder({ name: "my-session" });

// Wrap an async function
async function searchWeb(query: string): Promise<string[]> {
  // ... real implementation
  return ["result1", "result2"];
}

const trackedSearch = interceptFunction(searchWeb, recorder, {
  name: "searchWeb",
  type: "tool_call",
});

// Call it normally — input and output are recorded
const results = await trackedSearch("AI news");
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `fn.name` or `"anonymous"` | The step name in the trace |
| `type` | `StepType` | `"tool_call"` | The step type |

### Error Handling

If the wrapped function throws, the error is recorded in the step's `error` field and re-thrown to the caller:

```ts
const riskyFn = interceptFunction(async () => {
  throw new Error("Something went wrong");
}, recorder, { name: "risky" });

try {
  await riskyFn();
} catch (err) {
  // Error is both recorded in the trace AND re-thrown
  console.error(err.message); // "Something went wrong"
}
```

## Building Custom Interceptors

For SDKs not covered by the built-in interceptors, you can build your own using the recorder's `startStep` and `endStep` methods.

### Pattern: Deep Proxy

```ts
import { AgentRecorder } from "@agent-replay/core";

function interceptMySDK<T extends object>(client: T, recorder: AgentRecorder): T {
  return createProxy(client, recorder, "my-sdk");
}

function createProxy<T extends object>(
  obj: T,
  recorder: AgentRecorder,
  path: string
): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const fullPath = `${path}.${String(prop)}`;

      // Intercept function calls
      if (typeof value === "function") {
        return function (...args: unknown[]) {
          const stepId = recorder.startStep("llm_call", fullPath, args[0]);

          const result = value.apply(target, args);

          // Handle async results
          if (result && typeof result.then === "function") {
            return result.then(
              (response: any) => {
                const tokens = extractTokens(response); // your extraction logic
                recorder.endStep(stepId, response, { tokens, model: args[0]?.model });
                return response;
              },
              (err: Error) => {
                recorder.endStep(stepId, null, {
                  error: { message: err.message, stack: err.stack },
                });
                throw err;
              }
            );
          }

          recorder.endStep(stepId, result);
          return result;
        };
      }

      // Recursively proxy nested objects
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return createProxy(value as object, recorder, fullPath);
      }

      return value;
    },
  });
}
```

### Pattern: Simple Wrapper

For simpler cases, wrap individual methods:

```ts
const originalCreate = client.messages.create.bind(client.messages);

client.messages.create = async (params) => {
  const stepId = recorder.startStep("llm_call", "my-sdk.create", params);
  try {
    const response = await originalCreate(params);
    recorder.endStep(stepId, response, {
      model: params.model,
      tokens: { prompt: response.usage.input, completion: response.usage.output, total: response.usage.total },
    });
    return response;
  } catch (err) {
    recorder.endStep(stepId, null, { error: { message: err.message } });
    throw err;
  }
};
```
