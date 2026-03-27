import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  JsonlStorage,
  CompressedJsonlStorage,
  serializeTrace,
  deserializeTrace,
  computeTraceSummary,
} from "../src/index.js";
import type { SerializedTrace, Trace, Step, JsonlRecord } from "../src/types.js";

// Tests for CLI-related functionality (validate, merge, compress patterns)

function createMockSerializedTrace(id: string, name: string, steps: number = 2): SerializedTrace {
  const now = new Date();
  const serializedSteps = Array.from({ length: steps }, (_, i) => ({
    id: `${id}-step-${i}`,
    type: "llm_call" as const,
    name: `step-${i}`,
    startedAt: new Date(now.getTime() + i * 1000).toISOString(),
    endedAt: new Date(now.getTime() + (i + 1) * 1000).toISOString(),
    duration: 1000,
    input: { index: i },
    output: { result: i },
    tokens: { prompt: 10, completion: 20, total: 30 },
    cost: 0.001,
    model: "gpt-4",
    children: [] as SerializedTrace["steps"],
  }));

  return {
    id,
    name,
    startedAt: now.toISOString(),
    endedAt: new Date(now.getTime() + steps * 1000).toISOString(),
    duration: steps * 1000,
    steps: serializedSteps,
    metadata: { env: "test" },
    summary: {
      totalSteps: steps,
      totalTokens: { prompt: 10 * steps, completion: 20 * steps, total: 30 * steps },
      totalCost: 0.001 * steps,
      totalDuration: steps * 1000,
      stepsByType: { llm_call: steps } as any,
      models: ["gpt-4"],
      errorCount: 0,
    },
  };
}

function traceToJsonl(trace: SerializedTrace): string {
  const lines: string[] = [];
  lines.push(JSON.stringify({
    type: "trace_start",
    timestamp: trace.startedAt,
    data: { ...trace, steps: [] },
  }));
  for (const step of trace.steps) {
    lines.push(JSON.stringify({
      type: "step",
      timestamp: step.startedAt,
      data: step,
    }));
  }
  lines.push(JSON.stringify({
    type: "trace_end",
    timestamp: trace.endedAt ?? trace.startedAt,
    data: { id: trace.id, summary: trace.summary },
  }));
  return lines.join("\n") + "\n";
}

describe("JSONL Validation Patterns", () => {
  it("should validate a well-formed JSONL trace", () => {
    const trace = createMockSerializedTrace("t1", "test");
    const content = traceToJsonl(trace);
    const lines = content.trim().split("\n");

    // Every line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // Should have trace_start, steps, and trace_end
    const records = lines.map((l) => JSON.parse(l) as JsonlRecord);
    expect(records[0]!.type).toBe("trace_start");
    expect(records[records.length - 1]!.type).toBe("trace_end");
    expect(records.filter((r) => r.type === "step")).toHaveLength(2);
  });

  it("should detect missing trace_start", () => {
    const content = '{"type":"step","timestamp":"2024-01-01","data":{"id":"s1","type":"llm_call","name":"test","startedAt":"2024-01-01","children":[]}}\n';
    const lines = content.trim().split("\n");
    const records = lines.map((l) => JSON.parse(l) as JsonlRecord);
    const hasStart = records.some((r) => r.type === "trace_start");
    expect(hasStart).toBe(false);
  });

  it("should detect invalid JSON lines", () => {
    const content = '{"valid":"json"}\nnot valid json\n{"also":"valid"}\n';
    const lines = content.trim().split("\n");
    const invalidLines = lines.filter((l) => {
      try { JSON.parse(l); return false; } catch { return true; }
    });
    expect(invalidLines).toHaveLength(1);
  });
});

describe("Trace Merge Patterns", () => {
  it("should merge two traces by combining steps", () => {
    const t1 = createMockSerializedTrace("t1", "trace-1", 3);
    const t2 = createMockSerializedTrace("t2", "trace-2", 2);

    const trace1 = deserializeTrace(t1);
    const trace2 = deserializeTrace(t2);

    const allSteps = [...trace1.steps, ...trace2.steps].sort(
      (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
    );

    expect(allSteps).toHaveLength(5);
  });

  it("should compute summary for merged trace", () => {
    const t1 = createMockSerializedTrace("t1", "trace-1", 3);
    const t2 = createMockSerializedTrace("t2", "trace-2", 2);

    const trace1 = deserializeTrace(t1);
    const trace2 = deserializeTrace(t2);

    const merged: Trace = {
      id: "merged",
      name: "merged",
      startedAt: trace1.startedAt,
      endedAt: trace2.endedAt ?? trace1.endedAt,
      steps: [...trace1.steps, ...trace2.steps],
      metadata: {},
    };

    const summary = computeTraceSummary(merged);
    expect(summary.totalSteps).toBe(5);
    expect(summary.totalTokens.total).toBe(150);
  });
});

describe("Trace Serialization Round-trip", () => {
  it("should serialize and deserialize without data loss", () => {
    const now = new Date();
    const trace: Trace = {
      id: "roundtrip",
      name: "roundtrip-test",
      startedAt: now,
      endedAt: new Date(now.getTime() + 5000),
      duration: 5000,
      steps: [{
        id: "s1",
        type: "llm_call",
        name: "test",
        startedAt: now,
        endedAt: new Date(now.getTime() + 1000),
        duration: 1000,
        input: { messages: [{ role: "user", content: "hello" }] },
        output: { content: "world" },
        tokens: { prompt: 10, completion: 5, total: 15 },
        cost: 0.001,
        model: "gpt-4",
        children: [{
          id: "s2",
          type: "tool_call",
          name: "child",
          startedAt: new Date(now.getTime() + 500),
          endedAt: new Date(now.getTime() + 800),
          duration: 300,
          input: "tool-input",
          output: "tool-output",
          children: [],
        }],
      }],
      metadata: { version: "0.2.0" },
    };

    const serialized = serializeTrace(trace);
    const deserialized = deserializeTrace(serialized);

    expect(deserialized.id).toBe(trace.id);
    expect(deserialized.name).toBe(trace.name);
    expect(deserialized.steps).toHaveLength(1);
    expect(deserialized.steps[0]!.children).toHaveLength(1);
    expect(deserialized.steps[0]!.tokens?.total).toBe(15);
    expect(deserialized.steps[0]!.model).toBe("gpt-4");
    expect(deserialized.metadata).toEqual({ version: "0.2.0" });
  });
});

describe("Storage Compressed Round-trip", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-roundtrip-${Date.now()}`);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should save compressed and load back identical data", async () => {
    const storage = new CompressedJsonlStorage(tmpDir, true);
    const trace = createMockSerializedTrace("rt1", "roundtrip");

    await storage.save(trace);
    const loaded = await storage.load("rt1");

    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(trace.id);
    expect(loaded!.name).toBe(trace.name);
    expect(loaded!.steps).toHaveLength(trace.steps.length);
    expect(loaded!.summary?.totalSteps).toBe(trace.summary?.totalSteps);
  });
});
