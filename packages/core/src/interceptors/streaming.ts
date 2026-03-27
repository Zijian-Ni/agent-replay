import type { AgentRecorder } from "../recorder.js";
import type { TokenUsage, StepId } from "../types.js";

/** A single chunk from a streaming response */
export interface StreamChunk {
  index: number;
  timestamp: number;
  delta: unknown;
  finishReason?: string | null;
}

/** Accumulated streaming response */
export interface StreamAccumulator {
  chunks: StreamChunk[];
  fullContent: string;
  model?: string;
  tokens?: TokenUsage;
  startTime: number;
  endTime?: number;
}

/** Intercept an OpenAI streaming response and record chunks */
export function interceptOpenAIStream<T extends object>(
  client: T,
  recorder: AgentRecorder,
): T {
  return createStreamProxy(client, recorder, "openai", "openai");
}

/** Intercept an Anthropic streaming response and record chunks */
export function interceptAnthropicStream<T extends object>(
  client: T,
  recorder: AgentRecorder,
): T {
  return createStreamProxy(client, recorder, "anthropic", "anthropic");
}

function createStreamProxy<T extends object>(
  obj: T,
  recorder: AgentRecorder,
  path: string,
  provider: "openai" | "anthropic",
): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const propName = String(prop);
      const fullPath = `${path}.${propName}`;

      if (typeof value === "function") {
        return function (this: unknown, ...args: unknown[]) {
          const isCreate = propName === "create";
          if (!isCreate) {
            const result = value.apply(target, args);
            if (result && typeof result === "object" && !Array.isArray(result)) {
              return createStreamProxy(result, recorder, fullPath, provider);
            }
            return result;
          }

          const input = args[0] as Record<string, unknown> | undefined;
          const isStreaming = input?.stream === true;
          const model = (input?.model as string) ?? "unknown";

          if (!isStreaming) {
            // Non-streaming: delegate to normal interceptor behavior
            const stepId = recorder.startStep("llm_call", fullPath, input);
            const result = value.apply(target, args);
            if (result && typeof result.then === "function") {
              return (result as Promise<unknown>).then(
                (response: unknown) => {
                  const tokens = extractTokens(response, provider);
                  recorder.endStep(stepId, response, { tokens, model });
                  return response;
                },
                (err: Error) => {
                  recorder.endStep(stepId, null, {
                    error: { message: err.message, stack: err.stack },
                    model,
                  });
                  throw err;
                },
              );
            }
            return result;
          }

          // Streaming: wrap the async iterator
          const stepId = recorder.startStep("llm_call", `${fullPath} [stream]`, input);
          const accumulator: StreamAccumulator = {
            chunks: [],
            fullContent: "",
            model,
            startTime: Date.now(),
          };

          const result = value.apply(target, args);
          if (result && typeof result.then === "function") {
            return (result as Promise<unknown>).then(
              (stream: unknown) => wrapStream(stream, recorder, stepId, accumulator, provider),
              (err: Error) => {
                recorder.endStep(stepId, null, {
                  error: { message: err.message, stack: err.stack },
                  model,
                });
                throw err;
              },
            );
          }
          return result;
        };
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        return createStreamProxy(value as object, recorder, fullPath, provider);
      }

      return value;
    },
  });
}

function wrapStream(
  stream: unknown,
  recorder: AgentRecorder,
  stepId: StepId,
  accumulator: StreamAccumulator,
  provider: "openai" | "anthropic",
): unknown {
  if (!stream || typeof stream !== "object") return stream;

  const asyncIterable = stream as AsyncIterable<unknown> & Record<string, unknown>;

  // If it has Symbol.asyncIterator, wrap it
  if (Symbol.asyncIterator in asyncIterable) {
    const originalIterator = asyncIterable[Symbol.asyncIterator].bind(asyncIterable);

    const wrappedIterable = {
      ...asyncIterable,
      [Symbol.asyncIterator](): AsyncIterator<unknown> {
        const iterator = (originalIterator as () => AsyncIterator<unknown>)();
        let chunkIndex = 0;

        return {
          async next() {
            const result = await iterator.next();

            if (result.done) {
              // Stream finished — finalize the step
              accumulator.endTime = Date.now();
              recorder.endStep(stepId, {
                content: accumulator.fullContent,
                chunks: accumulator.chunks.length,
                model: accumulator.model,
              }, {
                tokens: accumulator.tokens,
                model: accumulator.model,
                metadata: {
                  streaming: true,
                  chunkCount: accumulator.chunks.length,
                  streamDuration: accumulator.endTime - accumulator.startTime,
                },
              });
              return result;
            }

            const chunk = result.value;
            const delta = extractDelta(chunk, provider);
            const chunkData: StreamChunk = {
              index: chunkIndex++,
              timestamp: Date.now(),
              delta,
              finishReason: extractFinishReason(chunk, provider),
            };

            accumulator.chunks.push(chunkData);
            if (typeof delta === "string") {
              accumulator.fullContent += delta;
            }

            // Extract final usage if present (some providers send it in the last chunk)
            const tokens = extractTokens(chunk, provider);
            if (tokens) {
              accumulator.tokens = tokens;
            }

            return result;
          },
          async return(value?: unknown) {
            if (iterator.return) {
              return iterator.return(value);
            }
            return { done: true as const, value: undefined };
          },
        };
      },
    };

    return wrappedIterable;
  }

  return stream;
}

function extractDelta(chunk: unknown, provider: "openai" | "anthropic"): unknown {
  if (!chunk || typeof chunk !== "object") return null;
  const c = chunk as Record<string, unknown>;

  if (provider === "openai") {
    const choices = c.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.[0]?.delta) {
      const delta = choices[0].delta as Record<string, unknown>;
      return delta.content ?? null;
    }
  }

  if (provider === "anthropic") {
    if (c.type === "content_block_delta") {
      const delta = c.delta as Record<string, unknown> | undefined;
      return delta?.text ?? null;
    }
  }

  return null;
}

function extractFinishReason(chunk: unknown, provider: "openai" | "anthropic"): string | null {
  if (!chunk || typeof chunk !== "object") return null;
  const c = chunk as Record<string, unknown>;

  if (provider === "openai") {
    const choices = c.choices as Array<Record<string, unknown>> | undefined;
    return (choices?.[0]?.finish_reason as string) ?? null;
  }

  if (provider === "anthropic") {
    if (c.type === "message_stop") return "end_turn";
    if (c.type === "message_delta") {
      const delta = c.delta as Record<string, unknown> | undefined;
      return (delta?.stop_reason as string) ?? null;
    }
  }

  return null;
}

function extractTokens(response: unknown, provider: "openai" | "anthropic"): TokenUsage | undefined {
  if (!response || typeof response !== "object") return undefined;
  const r = response as Record<string, unknown>;
  const usage = r.usage as Record<string, number> | undefined;
  if (!usage) return undefined;

  if (provider === "openai") {
    return {
      prompt: usage.prompt_tokens ?? 0,
      completion: usage.completion_tokens ?? 0,
      total: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
    };
  }

  if (provider === "anthropic") {
    return {
      prompt: usage.input_tokens ?? 0,
      completion: usage.output_tokens ?? 0,
      total: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    };
  }

  return undefined;
}

/** Reconstruct full response content from recorded stream chunks */
export function reconstructFromChunks(chunks: StreamChunk[]): string {
  return chunks
    .filter((c) => typeof c.delta === "string")
    .map((c) => c.delta as string)
    .join("");
}
