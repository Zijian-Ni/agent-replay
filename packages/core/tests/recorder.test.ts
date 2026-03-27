import { describe, it, expect, beforeEach } from "vitest";
import { AgentRecorder } from "../src/recorder.js";

describe("AgentRecorder", () => {
  let recorder: AgentRecorder;

  beforeEach(() => {
    recorder = new AgentRecorder({ name: "test-trace", storage: "memory" });
  });

  it("should create a trace with a unique ID", () => {
    expect(recorder.traceId).toBeDefined();
    expect(typeof recorder.traceId).toBe("string");
  });

  it("should create a trace with the given name", () => {
    const trace = recorder.getTrace();
    expect(trace.name).toBe("test-trace");
  });

  it("should record startedAt timestamp", () => {
    const trace = recorder.getTrace();
    expect(trace.startedAt).toBeInstanceOf(Date);
  });

  it("should start and end a step", () => {
    const stepId = recorder.startStep("llm_call", "test-step", { prompt: "hello" });
    recorder.endStep(stepId, { response: "world" });
    const trace = recorder.getTrace();
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]!.name).toBe("test-step");
    expect(trace.steps[0]!.type).toBe("llm_call");
    expect(trace.steps[0]!.input).toBeDefined();
    expect(trace.steps[0]!.output).toBeDefined();
    expect(trace.steps[0]!.duration).toBeGreaterThanOrEqual(0);
  });

  it("should record step with tokens and cost", () => {
    const stepId = recorder.startStep("llm_call", "gpt-call", { prompt: "hi" });
    recorder.endStep(stepId, { text: "hello" }, {
      tokens: { prompt: 10, completion: 20, total: 30 },
      cost: 0.001,
      model: "gpt-4",
    });
    const step = recorder.getTrace().steps[0]!;
    expect(step.tokens?.total).toBe(30);
    expect(step.cost).toBe(0.001);
    expect(step.model).toBe("gpt-4");
  });

  it("should record step errors", () => {
    const stepId = recorder.startStep("tool_call", "failing-tool", {});
    recorder.endStep(stepId, null, {
      error: { message: "Something went wrong", stack: "Error: Something went wrong\n  at..." },
    });
    const step = recorder.getTrace().steps[0]!;
    expect(step.error?.message).toBe("Something went wrong");
  });

  it("should support nested steps via parentId", () => {
    const parentId = recorder.startStep("llm_call", "parent", {});
    const childId = recorder.startStep("tool_call", "child", {}, parentId);
    recorder.endStep(childId, "child-result");
    recorder.endStep(parentId, "parent-result");
    const trace = recorder.getTrace();
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]!.children).toHaveLength(1);
    expect(trace.steps[0]!.children[0]!.name).toBe("child");
  });

  it("should add a complete step in one call", () => {
    recorder.addStep("tool_call", "quick-step", { input: 1 }, { output: 2 }, {
      tokens: { prompt: 5, completion: 10, total: 15 },
      cost: 0.0005,
      model: "gpt-4o-mini",
    });
    const trace = recorder.getTrace();
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]!.output).toEqual({ output: 2 });
  });

  it("should throw when ending a nonexistent step", () => {
    expect(() => recorder.endStep("nonexistent", {})).toThrow("not found");
  });

  it("should throw when starting a step after stop", async () => {
    await recorder.stop();
    expect(() => recorder.startStep("llm_call", "late", {})).toThrow("stopped");
  });

  it("should stop and finalize the trace", async () => {
    recorder.addStep("llm_call", "step-1", {}, {}, {
      tokens: { prompt: 100, completion: 50, total: 150 },
      cost: 0.01,
      model: "gpt-4",
    });
    recorder.addStep("tool_call", "step-2", {}, {});
    const trace = await recorder.stop();
    expect(trace.endedAt).toBeInstanceOf(Date);
    expect(trace.duration).toBeGreaterThanOrEqual(0);
    expect(trace.summary).toBeDefined();
    expect(trace.summary!.totalSteps).toBe(2);
    expect(trace.summary!.totalTokens.total).toBe(150);
    expect(trace.summary!.totalCost).toBe(0.01);
    expect(trace.summary!.models).toContain("gpt-4");
  });

  it("should compute error count in summary", async () => {
    recorder.addStep("llm_call", "ok-step", {}, {});
    recorder.addStep("error", "bad-step", {}, null, {
      error: { message: "fail" },
    });
    const trace = await recorder.stop();
    expect(trace.summary!.errorCount).toBe(1);
  });

  it("should be idempotent when stopping twice", async () => {
    const trace1 = await recorder.stop();
    const trace2 = await recorder.stop();
    expect(trace1).toBe(trace2);
  });

  it("should support metadata on the trace", () => {
    const r = new AgentRecorder({
      name: "meta-test",
      metadata: { version: "1.0", env: "test" },
    });
    const trace = r.getTrace();
    expect(trace.metadata).toEqual({ version: "1.0", env: "test" });
  });

  it("should intercept an object and record calls", async () => {
    const mockClient = {
      async doSomething(input: string) {
        return `result: ${input}`;
      },
    };
    const proxied = recorder.intercept(mockClient);
    const result = await proxied.doSomething("test");
    expect(result).toBe("result: test");
    const trace = recorder.getTrace();
    expect(trace.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("should intercept and capture errors from proxied calls", async () => {
    const mockClient = {
      async failingMethod() {
        throw new Error("proxy error");
      },
    };
    const proxied = recorder.intercept(mockClient);
    await expect(proxied.failingMethod()).rejects.toThrow("proxy error");
    const trace = recorder.getTrace();
    expect(trace.steps[0]!.error?.message).toBe("proxy error");
  });
});
