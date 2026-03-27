import type { AgentRecorder } from "../recorder.js";
import type { Plugin } from "./index.js";

/** Plugin for intercepting LangChain agent executions */
export const langchainPlugin: Plugin = {
  name: "langchain",
  version: "0.2.0",
  description: "Intercept and record LangChain agent executions",
  hooks: {
    onRegister(recorder) {
      // Hook is called when the plugin is attached to a recorder
      void recorder;
    },
    onAfterStep(step) {
      // Tag LangChain steps with metadata
      if (step.name.startsWith("langchain.")) {
        step.metadata = { ...step.metadata, framework: "langchain" };
      }
    },
  },
  createInterceptor<T extends object>(client: T, recorder: AgentRecorder): T {
    return createLangChainProxy(client, recorder, "langchain");
  },
};

function createLangChainProxy<T extends object>(
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
          // Intercept invoke/call/run methods
          const isInvoke = propName === "invoke" || propName === "call" || propName === "run" || propName === "stream";
          if (!isInvoke) {
            const result = value.apply(target, args);
            if (result && typeof result === "object" && !Array.isArray(result)) {
              return createLangChainProxy(result, recorder, fullPath);
            }
            return result;
          }

          const stepType = propName === "stream" ? "llm_call" : "tool_call";
          const stepId = recorder.startStep(stepType, fullPath, args[0]);

          try {
            const result = value.apply(target, args);
            if (result && typeof result === "object" && "then" in result) {
              return (result as Promise<unknown>).then(
                (res) => {
                  recorder.endStep(stepId, res, {
                    metadata: { framework: "langchain", method: propName },
                  });
                  return res;
                },
                (err: Error) => {
                  recorder.endStep(stepId, null, {
                    error: { message: err.message, stack: err.stack },
                    metadata: { framework: "langchain", method: propName },
                  });
                  throw err;
                },
              );
            }
            recorder.endStep(stepId, result, {
              metadata: { framework: "langchain", method: propName },
            });
            return result;
          } catch (err) {
            recorder.endStep(stepId, null, {
              error: { message: (err as Error).message, stack: (err as Error).stack },
              metadata: { framework: "langchain", method: propName },
            });
            throw err;
          }
        };
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        return createLangChainProxy(value as object, recorder, fullPath);
      }

      return value;
    },
  });
}
