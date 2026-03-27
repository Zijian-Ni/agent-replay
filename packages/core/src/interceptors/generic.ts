import type { AgentRecorder } from "../recorder.js";
import type { StepType } from "../types.js";

/** Wrap any async function to record its calls */
export function interceptFunction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  recorder: AgentRecorder,
  options?: { name?: string; type?: StepType }
): (...args: TArgs) => Promise<TReturn> {
  const name = options?.name ?? fn.name ?? "anonymous";
  const type = options?.type ?? "tool_call";

  return async (...args: TArgs): Promise<TReturn> => {
    const stepId = recorder.startStep(type, name, args);
    try {
      const result = await fn(...args);
      recorder.endStep(stepId, result);
      return result;
    } catch (err) {
      recorder.endStep(stepId, null, {
        error: {
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      });
      throw err;
    }
  };
}
