import type { TokenUsage } from "../types.js";
import type { AgentRecorder } from "../recorder.js";

const ANTHROPIC_PRICING: Record<string, { prompt: number; completion: number }> = {
  "claude-3-opus-20240229": { prompt: 15, completion: 75 },
  "claude-3-sonnet-20240229": { prompt: 3, completion: 15 },
  "claude-3-haiku-20240307": { prompt: 0.25, completion: 1.25 },
  "claude-3-5-sonnet-20241022": { prompt: 3, completion: 15 },
  "claude-opus-4-20250514": { prompt: 15, completion: 75 },
  "claude-sonnet-4-20250514": { prompt: 3, completion: 15 },
};

/** Create a proxy for the Anthropic SDK that records all calls */
export function interceptAnthropic<T extends object>(client: T, recorder: AgentRecorder): T {
  return createAnthropicProxy(client, recorder, "anthropic");
}

function createAnthropicProxy<T extends object>(
  obj: T,
  recorder: AgentRecorder,
  path: string
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
              return createAnthropicProxy(result, recorder, fullPath);
            }
            return result;
          }

          const input = args[0] as Record<string, unknown> | undefined;
          const model = (input?.model as string) ?? "unknown";
          const stepId = recorder.startStep("llm_call", fullPath, input);

          const result = value.apply(target, args);
          if (result && typeof result.then === "function") {
            return (result as Promise<unknown>).then(
              (response: any) => {
                const tokens = extractAnthropicTokens(response);
                const cost = calculateAnthropicCost(model, tokens);
                recorder.endStep(stepId, response, { tokens, cost, model });
                return response;
              },
              (err: Error) => {
                recorder.endStep(stepId, null, {
                  error: { message: err.message, stack: err.stack },
                  model,
                });
                throw err;
              }
            );
          }
          return result;
        };
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        return createAnthropicProxy(value as object, recorder, fullPath);
      }

      return value;
    },
  });
}

function extractAnthropicTokens(response: any): TokenUsage | undefined {
  const usage = response?.usage;
  if (!usage) return undefined;
  return {
    prompt: usage.input_tokens ?? 0,
    completion: usage.output_tokens ?? 0,
    total: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
  };
}

function calculateAnthropicCost(model: string, tokens?: TokenUsage): number | undefined {
  if (!tokens) return undefined;
  const pricing = ANTHROPIC_PRICING[model];
  if (!pricing) return undefined;
  return (
    (tokens.prompt / 1_000_000) * pricing.prompt +
    (tokens.completion / 1_000_000) * pricing.completion
  );
}
