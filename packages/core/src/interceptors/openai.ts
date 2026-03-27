import type { TokenUsage } from "../types.js";
import type { AgentRecorder } from "../recorder.js";

/** Pricing per 1M tokens (approximate, as of 2024) */
const OPENAI_PRICING: Record<string, { prompt: number; completion: number }> = {
  "gpt-4": { prompt: 30, completion: 60 },
  "gpt-4-turbo": { prompt: 10, completion: 30 },
  "gpt-4o": { prompt: 5, completion: 15 },
  "gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "gpt-3.5-turbo": { prompt: 0.5, completion: 1.5 },
};

/** Create a proxy for the OpenAI SDK that records all calls */
export function interceptOpenAI<T extends object>(client: T, recorder: AgentRecorder): T {
  return createDeepProxy(client, recorder, "openai");
}

function createDeepProxy<T extends object>(
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
              return createDeepProxy(result, recorder, fullPath);
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
                const tokens = extractTokens(response);
                const cost = calculateCost(model, tokens);
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
        return createDeepProxy(value as object, recorder, fullPath);
      }

      return value;
    },
  });
}

function extractTokens(response: any): TokenUsage | undefined {
  const usage = response?.usage;
  if (!usage) return undefined;
  return {
    prompt: usage.prompt_tokens ?? 0,
    completion: usage.completion_tokens ?? 0,
    total: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
  };
}

function calculateCost(model: string, tokens?: TokenUsage): number | undefined {
  if (!tokens) return undefined;
  const pricing = OPENAI_PRICING[model];
  if (!pricing) return undefined;
  return (
    (tokens.prompt / 1_000_000) * pricing.prompt +
    (tokens.completion / 1_000_000) * pricing.completion
  );
}
