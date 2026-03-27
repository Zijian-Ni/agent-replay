import { describe, it, expect } from "vitest";
import { diffTraces } from "../src/analysis/diff.js";
import { analyzeCost } from "../src/analysis/cost.js";
import { generateTimeline } from "../src/analysis/timeline.js";
import { detectAnomalies } from "../src/analysis/anomaly.js";
import type { Trace, Step } from "../src/types.js";

function makeStep(overrides: Partial<Step> & { id: string }): Step {
  return {
    type: "llm_call",
    name: overrides.id,
    startedAt: new Date("2024-01-01T00:00:00Z"),
    endedAt: new Date("2024-01-01T00:00:01Z"),
    duration: 1000,
    input: {},
    output: {},
    children: [],
    ...overrides,
  };
}

function makeTrace(steps: Step[], overrides?: Partial<Trace>): Trace {
  return {
    id: "trace-1",
    name: "test",
    startedAt: new Date("2024-01-01T00:00:00Z"),
    endedAt: new Date("2024-01-01T00:00:10Z"),
    duration: 10000,
    steps,
    metadata: {},
    ...overrides,
  };
}

describe("diffTraces", () => {
  it("should detect added steps", () => {
    const traceA = makeTrace([makeStep({ id: "s1" })]);
    const traceB = makeTrace([makeStep({ id: "s1" }), makeStep({ id: "s2" })]);
    const diff = diffTraces(traceA, traceB);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]!.id).toBe("s2");
  });

  it("should detect removed steps", () => {
    const traceA = makeTrace([makeStep({ id: "s1" }), makeStep({ id: "s2" })]);
    const traceB = makeTrace([makeStep({ id: "s1" })]);
    const diff = diffTraces(traceA, traceB);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]!.id).toBe("s2");
  });

  it("should detect modified steps", () => {
    const traceA = makeTrace([makeStep({ id: "s1", name: "original" })]);
    const traceB = makeTrace([makeStep({ id: "s1", name: "modified" })]);
    const diff = diffTraces(traceA, traceB);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]!.changes).toContain("name: original -> modified");
  });

  it("should compute summary diffs", () => {
    const traceA = makeTrace([makeStep({ id: "s1" })], {
      summary: {
        totalSteps: 1, totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCost: 0.01, totalDuration: 1000,
        stepsByType: {} as any, models: [], errorCount: 0,
      },
    });
    const traceB = makeTrace([makeStep({ id: "s1" }), makeStep({ id: "s2" })], {
      summary: {
        totalSteps: 2, totalTokens: { prompt: 20, completion: 20, total: 40 },
        totalCost: 0.02, totalDuration: 2000,
        stepsByType: {} as any, models: [], errorCount: 0,
      },
    });
    const diff = diffTraces(traceA, traceB);
    expect(diff.summary.tokenDiff).toBe(20);
    expect(diff.summary.costDiff).toBeCloseTo(0.01);
    expect(diff.summary.stepCountDiff).toBe(1);
  });

  it("should handle identical traces", () => {
    const trace = makeTrace([makeStep({ id: "s1" })]);
    const diff = diffTraces(trace, trace);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });
});

describe("analyzeCost", () => {
  it("should break down cost by model", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", model: "gpt-4", cost: 0.03, tokens: { prompt: 100, completion: 50, total: 150 } }),
      makeStep({ id: "s2", model: "gpt-4o-mini", cost: 0.001, tokens: { prompt: 50, completion: 25, total: 75 } }),
      makeStep({ id: "s3", model: "gpt-4", cost: 0.02, tokens: { prompt: 80, completion: 40, total: 120 } }),
    ]);
    const breakdown = analyzeCost(trace);
    expect(breakdown.byModel["gpt-4"]!.calls).toBe(2);
    expect(breakdown.byModel["gpt-4"]!.cost).toBeCloseTo(0.05);
    expect(breakdown.byModel["gpt-4o-mini"]!.calls).toBe(1);
    expect(breakdown.total).toBeCloseTo(0.051);
  });

  it("should break down cost by step type", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", type: "llm_call", cost: 0.01 }),
      makeStep({ id: "s2", type: "tool_call", cost: 0 }),
      makeStep({ id: "s3", type: "llm_call", cost: 0.02 }),
    ]);
    const breakdown = analyzeCost(trace);
    expect(breakdown.byStepType["llm_call"]!.count).toBe(2);
    expect(breakdown.byStepType["llm_call"]!.cost).toBeCloseTo(0.03);
  });

  it("should handle trace with no costs", () => {
    const trace = makeTrace([makeStep({ id: "s1" })]);
    const breakdown = analyzeCost(trace);
    expect(breakdown.total).toBe(0);
  });
});

describe("generateTimeline", () => {
  it("should generate timeline entries", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", duration: 2000 }),
      makeStep({ id: "s2", duration: 3000, startedAt: new Date("2024-01-01T00:00:02Z") }),
    ]);
    const timeline = generateTimeline(trace);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]!.depth).toBe(0);
    expect(timeline[0]!.startOffset).toBe(0);
  });

  it("should handle nested steps with depth", () => {
    const child = makeStep({ id: "child", startedAt: new Date("2024-01-01T00:00:00Z") });
    const parent = makeStep({ id: "parent", children: [child] });
    const trace = makeTrace([parent]);
    const timeline = generateTimeline(trace);
    expect(timeline).toHaveLength(2);
    expect(timeline.find((e) => e.step.id === "child")!.depth).toBe(1);
  });

  it("should sort by start offset", () => {
    const trace = makeTrace([
      makeStep({ id: "s2", startedAt: new Date("2024-01-01T00:00:05Z") }),
      makeStep({ id: "s1", startedAt: new Date("2024-01-01T00:00:01Z") }),
    ]);
    const timeline = generateTimeline(trace);
    expect(timeline[0]!.step.id).toBe("s1");
    expect(timeline[1]!.step.id).toBe("s2");
  });

  it("should calculate percentage of total", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", duration: 5000 }),
    ]);
    const timeline = generateTimeline(trace);
    expect(timeline[0]!.percentOfTotal).toBe(50); // 5000/10000 * 100
  });
});

describe("detectAnomalies", () => {
  it("should detect slow steps", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", duration: 50000 }),
    ]);
    const anomalies = detectAnomalies(trace);
    expect(anomalies.some((a) => a.type === "slow_step")).toBe(true);
  });

  it("should detect high cost steps", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", cost: 1.5 }),
    ]);
    const anomalies = detectAnomalies(trace);
    expect(anomalies.some((a) => a.type === "high_cost")).toBe(true);
  });

  it("should detect token spikes", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", tokens: { prompt: 10, completion: 10, total: 20 } }),
      makeStep({ id: "s2", tokens: { prompt: 10, completion: 10, total: 20 } }),
      makeStep({ id: "s3", tokens: { prompt: 10, completion: 10, total: 20 } }),
      makeStep({ id: "s4", tokens: { prompt: 10, completion: 10, total: 20 } }),
      makeStep({ id: "s5", tokens: { prompt: 5000, completion: 5000, total: 10000 } }),
    ]);
    const anomalies = detectAnomalies(trace);
    expect(anomalies.some((a) => a.type === "token_spike")).toBe(true);
  });

  it("should detect high error rate", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", error: { message: "err" } }),
      makeStep({ id: "s2", error: { message: "err" } }),
      makeStep({ id: "s3" }),
    ]);
    const anomalies = detectAnomalies(trace);
    expect(anomalies.some((a) => a.type === "error_rate")).toBe(true);
  });

  it("should detect repeated errors", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", error: { message: "same error" } }),
      makeStep({ id: "s2", error: { message: "same error" } }),
      makeStep({ id: "s3", error: { message: "same error" } }),
      makeStep({ id: "s4" }),
      makeStep({ id: "s5" }),
    ]);
    const anomalies = detectAnomalies(trace);
    expect(anomalies.some((a) => a.type === "repeated_error")).toBe(true);
  });

  it("should respect custom thresholds", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", duration: 5000 }),
    ]);
    const anomalies = detectAnomalies(trace, { slowStepMs: 1000 });
    expect(anomalies.some((a) => a.type === "slow_step")).toBe(true);
  });

  it("should return no anomalies for a clean trace", () => {
    const trace = makeTrace([
      makeStep({ id: "s1", duration: 100, cost: 0.001, tokens: { prompt: 10, completion: 10, total: 20 } }),
    ]);
    const anomalies = detectAnomalies(trace);
    expect(anomalies).toHaveLength(0);
  });
});
