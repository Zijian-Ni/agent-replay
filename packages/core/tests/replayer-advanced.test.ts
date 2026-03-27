import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentReplayer } from "../src/replayer.js";
import type { Trace, Step, Breakpoint } from "../src/types.js";

function createMockTrace(stepCount = 5): Trace {
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
      cost: 0.01 * (i + 1),
      model: i < 3 ? "gpt-4" : "gpt-3.5-turbo",
      children: [],
    });
  }
  // Add one error step
  steps.push({
    id: "step-error",
    type: "error",
    name: "error-step",
    startedAt: new Date(now.getTime() + stepCount * 1000),
    endedAt: new Date(now.getTime() + (stepCount + 1) * 1000),
    duration: 1000,
    input: {},
    output: null,
    error: { message: "something failed" },
    children: [],
  });

  return {
    id: "test-trace",
    name: "test",
    startedAt: now,
    endedAt: new Date(now.getTime() + (stepCount + 1) * 1000),
    duration: (stepCount + 1) * 1000,
    steps,
    metadata: {},
  };
}

describe("Advanced Replay - Breakpoints", () => {
  it("should stop on cost breakpoint", async () => {
    const trace = createMockTrace();
    const onBreakpoint = vi.fn();
    const replayer = new AgentReplayer(trace, {
      breakpoints: [{ type: "cost", costThreshold: 0.05, label: "cost-limit" }],
      onBreakpoint,
    });

    // Replay until breakpoint
    const steps = await replayer.replayAll();
    expect(replayer.isPaused).toBe(true);
    expect(onBreakpoint).toHaveBeenCalled();
    expect(onBreakpoint.mock.calls[0][0].label).toBe("cost-limit");
  });

  it("should stop on error breakpoint", async () => {
    const trace = createMockTrace();
    const onBreakpoint = vi.fn();
    const replayer = new AgentReplayer(trace, {
      breakpoints: [{ type: "error" }],
      onBreakpoint,
    });

    const steps = await replayer.replayAll();
    expect(replayer.isPaused).toBe(true);
    expect(onBreakpoint).toHaveBeenCalled();
  });

  it("should stop on tool name breakpoint", async () => {
    const trace = createMockTrace();
    const onBreakpoint = vi.fn();
    const replayer = new AgentReplayer(trace, {
      breakpoints: [{ type: "tool", toolName: "step-1" }],
      onBreakpoint,
    });

    await replayer.next(); // step-0
    await replayer.next(); // step-1 — should trigger
    expect(replayer.isPaused).toBe(true);
  });

  it("should stop on model breakpoint", async () => {
    const trace = createMockTrace();
    const onBreakpoint = vi.fn();
    const replayer = new AgentReplayer(trace, {
      breakpoints: [{ type: "model", modelName: "gpt-3.5-turbo" }],
      onBreakpoint,
    });

    // Should stop at step-3 (first gpt-3.5-turbo)
    await replayer.next(); // step-0 (gpt-4)
    await replayer.next(); // step-1 (gpt-4)
    await replayer.next(); // step-2 (gpt-4)
    await replayer.next(); // step-3 (gpt-3.5-turbo) — breakpoint!
    expect(replayer.isPaused).toBe(true);
  });

  it("should stop on custom breakpoint", async () => {
    const trace = createMockTrace();
    const replayer = new AgentReplayer(trace, {
      breakpoints: [{
        type: "custom",
        predicate: (step, idx) => idx === 2,
        label: "at-index-2",
      }],
    });

    await replayer.next(); // 0
    await replayer.next(); // 1
    await replayer.next(); // 2 — breakpoint
    expect(replayer.isPaused).toBe(true);
  });

  it("should resume after breakpoint", async () => {
    const trace = createMockTrace();
    const replayer = new AgentReplayer(trace, {
      breakpoints: [{ type: "custom", predicate: (_, idx) => idx === 1 }],
    });

    await replayer.next(); // step-0
    await replayer.next(); // step-1 — paused
    expect(replayer.isPaused).toBe(true);

    const step = await replayer.resume();
    expect(step?.id).toBe("step-1");
    expect(replayer.isPaused).toBe(false);
  });

  it("should add and clear breakpoints", () => {
    const replayer = new AgentReplayer(createMockTrace());
    replayer.addBreakpoint({ type: "error" });
    replayer.addBreakpoint({ type: "cost", costThreshold: 1.0 });
    replayer.clearBreakpoints();
    // No breakpoints should fire now
  });
});

describe("Advanced Replay - Speed Control", () => {
  it("should set and get speed", () => {
    const replayer = new AgentReplayer(createMockTrace());
    replayer.setSpeed(5);
    expect(replayer.getSpeed()).toBe(5);
  });

  it("should use instant replay with speed=0", async () => {
    const replayer = new AgentReplayer(createMockTrace(), { speed: 0 });
    const start = Date.now();
    await replayer.replayAll();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500); // Should be near-instant
  });
});

describe("Advanced Replay - Checkpoints", () => {
  it("should save and restore checkpoints", async () => {
    const replayer = new AgentReplayer(createMockTrace());
    await replayer.next();
    await replayer.next();

    const checkpoint = replayer.saveCheckpoint("midway");
    expect(checkpoint.index).toBe(2);
    expect(checkpoint.label).toBe("midway");

    await replayer.next();
    await replayer.next();
    expect(replayer.currentStepIndex).toBe(4);

    const restored = replayer.restoreCheckpoint("midway");
    expect(restored).toBe(true);
    expect(replayer.currentStepIndex).toBe(2);
  });

  it("should return false for nonexistent checkpoint", () => {
    const replayer = new AgentReplayer(createMockTrace());
    expect(replayer.restoreCheckpoint("nonexistent")).toBe(false);
  });

  it("should list checkpoints", async () => {
    const replayer = new AgentReplayer(createMockTrace());
    replayer.saveCheckpoint("a");
    await replayer.next();
    replayer.saveCheckpoint("b");

    const checkpoints = replayer.listCheckpoints();
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints.map((c) => c.label)).toContain("a");
    expect(checkpoints.map((c) => c.label)).toContain("b");
  });

  it("should auto-name checkpoints", () => {
    const replayer = new AgentReplayer(createMockTrace());
    const cp = replayer.saveCheckpoint();
    expect(cp.label).toBe("checkpoint-0");
  });

  it("should recalculate cumulative cost on restore", async () => {
    const replayer = new AgentReplayer(createMockTrace());
    await replayer.next(); // cost: 0.01
    replayer.saveCheckpoint("after-first");
    await replayer.next(); // cost: 0.02
    await replayer.next(); // cost: 0.03

    replayer.restoreCheckpoint("after-first");
    expect(replayer.getCumulativeCost()).toBeCloseTo(0.01, 4);
  });
});

describe("Advanced Replay - Model Substitution", () => {
  it("should substitute models", () => {
    const trace = createMockTrace();
    const replayer = new AgentReplayer(trace, {
      modelSubstitutions: { "gpt-4": "gpt-3.5-turbo" },
    });

    const step = replayer.getStep(0);
    expect(step?.model).toBe("gpt-3.5-turbo");
    expect(step?.metadata?.originalModel).toBe("gpt-4");
  });

  it("should not substitute unmatched models", () => {
    const trace = createMockTrace();
    const replayer = new AgentReplayer(trace, {
      modelSubstitutions: { "claude-3": "gpt-4" },
    });

    const step = replayer.getStep(0);
    expect(step?.model).toBe("gpt-4"); // unchanged
    expect(step?.metadata?.originalModel).toBeUndefined();
  });
});

describe("Advanced Replay - Cumulative Cost", () => {
  it("should track cumulative cost", async () => {
    const replayer = new AgentReplayer(createMockTrace());
    expect(replayer.getCumulativeCost()).toBe(0);

    await replayer.next(); // 0.01
    expect(replayer.getCumulativeCost()).toBeCloseTo(0.01, 4);

    await replayer.next(); // 0.02
    expect(replayer.getCumulativeCost()).toBeCloseTo(0.03, 4);
  });

  it("should reset cumulative cost on reset", async () => {
    const replayer = new AgentReplayer(createMockTrace());
    await replayer.next();
    await replayer.next();
    replayer.reset();
    expect(replayer.getCumulativeCost()).toBe(0);
  });

  it("should recalculate cumulative cost on seek", async () => {
    const replayer = new AgentReplayer(createMockTrace());
    await replayer.next();
    await replayer.next();
    await replayer.next();

    replayer.seek(1);
    expect(replayer.getCumulativeCost()).toBeCloseTo(0.01, 4);
  });
});
