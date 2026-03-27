import type { AgentRecorder } from "../recorder.js";
import type { Plugin } from "./index.js";

/** Plugin for intercepting CrewAI agent executions */
export const crewaiPlugin: Plugin = {
  name: "crewai",
  version: "0.2.0",
  description: "Intercept and record CrewAI agent executions",
  hooks: {
    onAfterStep(step) {
      if (step.name.startsWith("crewai.")) {
        step.metadata = { ...step.metadata, framework: "crewai" };
      }
    },
  },
  createInterceptor<T extends object>(client: T, recorder: AgentRecorder): T {
    return createCrewAIProxy(client, recorder, "crewai");
  },
};

function createCrewAIProxy<T extends object>(
  obj: T,
  recorder: AgentRecorder,
  path: string,
): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const propName = String(prop);
      const fullPath = `${path}.${propName}`;

      if (typeof value === "function") {
        return function (this: unknown, ...args: unknown[]) {
          // Intercept kickoff/execute/run methods typical of CrewAI
          const isExecute = propName === "kickoff" || propName === "execute" || propName === "run";
          if (!isExecute) {
            const result = value.apply(target, args);
            if (result && typeof result === "object" && !Array.isArray(result)) {
              return createCrewAIProxy(result, recorder, fullPath);
            }
            return result;
          }

          const stepId = recorder.startStep("tool_call", fullPath, args[0]);

          try {
            const result = value.apply(target, args);
            if (result && typeof result === "object" && "then" in result) {
              return (result as Promise<unknown>).then(
                (res) => {
                  recorder.endStep(stepId, res, {
                    metadata: { framework: "crewai", method: propName },
                  });
                  return res;
                },
                (err: Error) => {
                  recorder.endStep(stepId, null, {
                    error: { message: err.message, stack: err.stack },
                    metadata: { framework: "crewai", method: propName },
                  });
                  throw err;
                },
              );
            }
            recorder.endStep(stepId, result, {
              metadata: { framework: "crewai", method: propName },
            });
            return result;
          } catch (err) {
            recorder.endStep(stepId, null, {
              error: { message: (err as Error).message, stack: (err as Error).stack },
              metadata: { framework: "crewai", method: propName },
            });
            throw err;
          }
        };
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        return createCrewAIProxy(value as object, recorder, fullPath);
      }

      return value;
    },
  });
}
