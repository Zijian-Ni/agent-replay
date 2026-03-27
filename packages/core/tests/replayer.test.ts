import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentReplayer } from "../src/replayer.js";
import type { Trace, Step } from "../src/types.js";

function createMockTrace(stepCount = 3): Trace {
  const now = new Date();
  const steps: Step[] = [];
  for (let i = 0; i < stepCount; i++) {
    steps.push({
      id: `step-${i}`,
      type: i % 2 === 0 ? "llm_call" : "tool_call",
      name: `step-${i}`,
      startedAt: new Date(now.getTime() + i * 1000),
      endedAt: new Date(now.getTime() + (i + 1) * 1000),
      duration: 1000,
      input: { index: i },
      output: { result: i },
      children: [],
    });
  }
  return {
    id: "test-trace",
    name: "test",
    startedAt: now,
    endedAt: new Date(now.getTime() + stepCount * 1000),
    duration: stepCount * 1000,
    steps,
    metadata: {},
  };
}

describe("AgentReplayer", () => {
  let replayer: AgentReplayer;
  let trace: Trace;

  beforeEach(() => {
    trace = createMockTrace(5);
    replayer = new AgentReplayer(trace);
  });

  it("should report total steps", () => {
    expect(replayer.totalSteps).toBe(5);
  });

  it("should start at index 0", () => {
    expect(replayer.currentStepIndex).toBe(0);
  });

  it("should advance through steps with next()", async () => {
    const step1 = await replayer.next();
    expect(step1?.id).toBe("step-0");
    expect(replayer.currentStepIndex).toBe(1);

    const step2 = await replayer.next();
    expect(step2?.id).toBe("step-1");
    expect(replayer.currentStepIndex).toBe(2);
  });

  it("should return null when no more steps", async () => {
    for (let i = 0; i < 5; i++) await replayer.next();
    const result = await replayer.next();
    expect(result).toBeNull();
  });

  it("should seek to a specific step", () => {
    const step = replayer.seek(3);
    expect(step?.id).toBe("step-3");
    expect(replayer.currentStepIndex).toBe(3);
  });

  it("should return undefined for invalid seek", () => {
    expect(replayer.seek(-1)).toBeUndefined();
    expect(replayer.seek(100)).toBeUndefined();
  });

  it("should reset to beginning", async () => {
    await replayer.next();
    await replayer.next();
    replayer.reset();
    expect(replayer.currentStepIndex).toBe(0);
  });

  it("should report hasNext correctly", async () => {
    expect(replayer.hasNext()).toBe(true);
    for (let i = 0; i < 5; i++) await replayer.next();
    expect(replayer.hasNext()).toBe(false);
  });

  it("should replay all steps", async () => {
    const steps = await replayer.replayAll();
    expect(steps).toHaveLength(5);
    expect(replayer.hasNext()).toBe(false);
  });

  it("should call onStep callback", async () => {
    const onStep = vi.fn();
    const r = new AgentReplayer(trace, { onStep });
    await r.next();
    expect(onStep).toHaveBeenCalledOnce();
    expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ id: "step-0" }), 0);
  });

  it("should get step by index", () => {
    expect(replayer.getStep(2)?.id).toBe("step-2");
    expect(replayer.getStep(10)).toBeUndefined();
  });

  it("should get current step", () => {
    expect(replayer.getCurrentStep()?.id).toBe("step-0");
  });

  it("should get the trace", () => {
    expect(replayer.getTrace().id).toBe("test-trace");
  });

  it("should fork from current position", async () => {
    await replayer.next();
    await replayer.next();
    const forked = replayer.fork();
    expect(forked.totalSteps).toBe(2);
    expect(forked.getTrace().id).toContain("fork");
  });

  it("should fork with modifications", async () => {
    await replayer.next();
    const forked = replayer.fork({
      steps: [{ id: "step-0", name: "modified-step" } as Partial<Step> as Step],
    });
    expect(forked.getStep(0)?.name).toBe("modified-step");
  });

  it("should flatten nested children for replay", () => {
    const nestedTrace: Trace = {
      id: "nested",
      name: "nested",
      startedAt: new Date(),
      steps: [
        {
          id: "parent",
          type: "llm_call",
          name: "parent",
          startedAt: new Date(),
          input: {},
          children: [
            {
              id: "child",
              type: "tool_call",
              name: "child",
              startedAt: new Date(),
              input: {},
              children: [],
            },
          ],
        },
      ],
      metadata: {},
    };
    const r = new AgentReplayer(nestedTrace);
    expect(r.totalSteps).toBe(2);
  });
});
