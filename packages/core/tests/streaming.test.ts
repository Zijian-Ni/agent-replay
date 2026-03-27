import { describe, it, expect, vi } from "vitest";
import { AgentRecorder } from "../src/recorder.js";
import {
  interceptOpenAIStream,
  interceptAnthropicStream,
  reconstructFromChunks,
} from "../src/interceptors/streaming.js";
import type { StreamChunk } from "../src/interceptors/streaming.js";

function createMockOpenAIStreamClient() {
  return {
    chat: {
      completions: {
        async create(params: Record<string, unknown>) {
          if (params.stream) {
            // Return an async iterable simulating streaming
            return {
              [Symbol.asyncIterator]: async function* () {
                yield {
                  choices: [{ delta: { content: "Hello" }, finish_reason: null }],
                };
                yield {
                  choices: [{ delta: { content: " world" }, finish_reason: null }],
                };
                yield {
                  choices: [{ delta: { content: "!" }, finish_reason: "stop" }],
                  usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
                };
              },
            };
          }
          return {
            choices: [{ message: { content: "Hello world!" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          };
        },
      },
    },
  };
}

function createMockAnthropicStreamClient() {
  return {
    messages: {
      async create(params: Record<string, unknown>) {
        if (params.stream) {
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { type: "content_block_delta", delta: { text: "Hi" } };
              yield { type: "content_block_delta", delta: { text: " there" } };
              yield {
                type: "message_delta",
                delta: { stop_reason: "end_turn" },
                usage: { input_tokens: 8, output_tokens: 2 },
              };
              yield { type: "message_stop" };
            },
          };
        }
        return {
          content: [{ text: "Hi there" }],
          usage: { input_tokens: 8, output_tokens: 2 },
        };
      },
    },
  };
}

describe("Streaming Interceptor - OpenAI", () => {
  it("should intercept non-streaming requests normally", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const client = createMockOpenAIStreamClient();
    const proxied = interceptOpenAIStream(client, recorder);

    const result = await proxied.chat.completions.create({
      model: "gpt-4",
      messages: [],
    }) as any;

    expect(result.choices[0].message.content).toBe("Hello world!");
    const trace = recorder.getTrace();
    expect(trace.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("should intercept streaming requests and collect chunks", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const client = createMockOpenAIStreamClient();
    const proxied = interceptOpenAIStream(client, recorder);

    const stream = await proxied.chat.completions.create({
      model: "gpt-4",
      messages: [],
      stream: true,
    }) as AsyncIterable<unknown>;

    const chunks: unknown[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    const trace = recorder.getTrace();
    expect(trace.steps.length).toBeGreaterThanOrEqual(1);

    const step = trace.steps[0]!;
    expect(step.name).toContain("[stream]");
    expect(step.output).toBeDefined();
    expect((step.output as any).content).toBe("Hello world!");
  });

  it("should record streaming metadata", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const client = createMockOpenAIStreamClient();
    const proxied = interceptOpenAIStream(client, recorder);

    const stream = await proxied.chat.completions.create({
      model: "gpt-4",
      messages: [],
      stream: true,
    }) as AsyncIterable<unknown>;

    for await (const _ of stream) { /* consume */ }

    const step = recorder.getTrace().steps[0]!;
    expect(step.metadata?.streaming).toBe(true);
    expect(step.metadata?.chunkCount).toBe(3);
  });
});

describe("Streaming Interceptor - Anthropic", () => {
  it("should intercept Anthropic streaming responses", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const client = createMockAnthropicStreamClient();
    const proxied = interceptAnthropicStream(client, recorder);

    const stream = await proxied.messages.create({
      model: "claude-3-sonnet-20240229",
      messages: [],
      stream: true,
    }) as AsyncIterable<unknown>;

    const chunks: unknown[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(4);
    const trace = recorder.getTrace();
    expect(trace.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("should intercept non-streaming Anthropic requests", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const client = createMockAnthropicStreamClient();
    const proxied = interceptAnthropicStream(client, recorder);

    const result = await proxied.messages.create({
      model: "claude-3-sonnet-20240229",
      messages: [],
    }) as any;

    expect(result.content[0].text).toBe("Hi there");
  });
});

describe("reconstructFromChunks", () => {
  it("should reconstruct content from string chunks", () => {
    const chunks: StreamChunk[] = [
      { index: 0, timestamp: Date.now(), delta: "Hello" },
      { index: 1, timestamp: Date.now(), delta: " " },
      { index: 2, timestamp: Date.now(), delta: "world" },
    ];
    expect(reconstructFromChunks(chunks)).toBe("Hello world");
  });

  it("should skip non-string deltas", () => {
    const chunks: StreamChunk[] = [
      { index: 0, timestamp: Date.now(), delta: "Hello" },
      { index: 1, timestamp: Date.now(), delta: null },
      { index: 2, timestamp: Date.now(), delta: "!" },
    ];
    expect(reconstructFromChunks(chunks)).toBe("Hello!");
  });

  it("should return empty string for empty chunks", () => {
    expect(reconstructFromChunks([])).toBe("");
  });
});
