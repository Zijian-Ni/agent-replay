import { describe, it, expect, vi } from "vitest";
import { AgentRecorder } from "../src/recorder.js";
import { interceptFunction } from "../src/interceptors/generic.js";

describe("interceptFunction", () => {
  it("should wrap a sync function and record its call", async () => {
    const recorder = new AgentRecorder({ name: "test" });
    const add = (a: number, b: number) => a + b;
    const wrapped = interceptFunction(add, recorder, { name: "add" });

    const result = await wrapped(2, 3);
    expect(result).toBe(5);

    const trace = recorder.getTrace();
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]!.name).toBe("add");
    expect(trace.steps[0]!.type).toBe("tool_call");
    expect(trace.steps[0]!.output).toBe(5);
  });

  it("should wrap an async function and record its call", async () => {
    const recorder = new AgentRecorder({ name: "test" });
    const asyncFn = async (x: number) => x * 2;
    const wrapped = interceptFunction(asyncFn, recorder, { name: "double" });

    const result = await wrapped(5);
    expect(result).toBe(10);

    const trace = recorder.getTrace();
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]!.output).toBe(10);
  });

  it("should record errors from wrapped functions", async () => {
    const recorder = new AgentRecorder({ name: "test" });
    const failing = async () => { throw new Error("test error"); };
    const wrapped = interceptFunction(failing, recorder, { name: "fail" });

    await expect(wrapped()).rejects.toThrow("test error");

    const trace = recorder.getTrace();
    expect(trace.steps[0]!.error?.message).toBe("test error");
  });

  it("should use function name when no name provided", async () => {
    const recorder = new AgentRecorder({ name: "test" });
    function myFunc() { return 42; }
    const wrapped = interceptFunction(myFunc, recorder);

    await wrapped();
    expect(recorder.getTrace().steps[0]!.name).toBe("myFunc");
  });

  it("should support custom step type", async () => {
    const recorder = new AgentRecorder({ name: "test" });
    const fn = () => "ok";
    const wrapped = interceptFunction(fn, recorder, { type: "decision" });

    await wrapped();
    expect(recorder.getTrace().steps[0]!.type).toBe("decision");
  });

  it("should record input arguments", async () => {
    const recorder = new AgentRecorder({ name: "test" });
    const fn = (a: string, b: number) => `${a}-${b}`;
    const wrapped = interceptFunction(fn, recorder, { name: "format" });

    await wrapped("hello", 42);
    const step = recorder.getTrace().steps[0]!;
    expect(step.input).toEqual(["hello", 42]);
  });
});

describe("Proxy-based interception", () => {
  it("should intercept nested object methods", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const client = {
      chat: {
        completions: {
          async create(params: any) {
            return { choices: [{ message: { content: "Hello!" } }] };
          },
        },
      },
    };

    const proxied = recorder.intercept(client);
    const result = await proxied.chat.completions.create({ model: "gpt-4", messages: [] });
    expect(result.choices[0].message.content).toBe("Hello!");

    const trace = recorder.getTrace();
    expect(trace.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle synchronous method calls", () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const obj = {
      getValue() { return 42; },
    };
    const proxied = recorder.intercept(obj);
    expect(proxied.getValue()).toBe(42);
  });
});
