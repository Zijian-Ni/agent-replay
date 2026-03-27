import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonlStorage } from "../src/storage/jsonl.js";
import { MemoryStorage } from "../src/storage/memory.js";
import { createStorage } from "../src/storage/index.js";
import type { SerializedTrace, TraceSummary } from "../src/types.js";

function createMockSerializedTrace(id = "trace-1", name = "test"): SerializedTrace {
  return {
    id,
    name,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    duration: 1000,
    steps: [
      {
        id: "step-1",
        type: "llm_call",
        name: "test-step",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        duration: 500,
        input: { prompt: "hello" },
        output: { response: "world" },
        tokens: { prompt: 10, completion: 20, total: 30 },
        cost: 0.001,
        model: "gpt-4",
        children: [],
      },
    ],
    metadata: { env: "test" },
    summary: {
      totalSteps: 1,
      totalTokens: { prompt: 10, completion: 20, total: 30 },
      totalCost: 0.001,
      totalDuration: 1000,
      stepsByType: { llm_call: 1 } as any,
      models: ["gpt-4"],
      errorCount: 0,
    },
  };
}

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("should save and load a trace", async () => {
    const trace = createMockSerializedTrace();
    await storage.save(trace);
    const loaded = await storage.load("trace-1");
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe("trace-1");
    expect(loaded!.name).toBe("test");
  });

  it("should return null for nonexistent trace", async () => {
    expect(await storage.load("nonexistent")).toBeNull();
  });

  it("should list trace IDs", async () => {
    await storage.save(createMockSerializedTrace("a"));
    await storage.save(createMockSerializedTrace("b"));
    const ids = await storage.list();
    expect(ids).toHaveLength(2);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("should delete a trace", async () => {
    await storage.save(createMockSerializedTrace("to-delete"));
    await storage.delete("to-delete");
    expect(await storage.load("to-delete")).toBeNull();
  });

  it("should search traces by name", async () => {
    await storage.save(createMockSerializedTrace("id-1", "chatbot-run"));
    await storage.save(createMockSerializedTrace("id-2", "search-agent"));
    const results = await storage.search("chatbot");
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("chatbot-run");
  });

  it("should search traces by id", async () => {
    await storage.save(createMockSerializedTrace("unique-id", "test"));
    const results = await storage.search("unique-id");
    expect(results).toHaveLength(1);
  });

  it("should clear all traces", async () => {
    await storage.save(createMockSerializedTrace("a"));
    await storage.save(createMockSerializedTrace("b"));
    storage.clear();
    expect(storage.size).toBe(0);
  });

  it("should deep clone on save/load", async () => {
    const trace = createMockSerializedTrace();
    await storage.save(trace);
    trace.name = "modified";
    const loaded = await storage.load("trace-1");
    expect(loaded!.name).toBe("test");
  });
});

describe("JsonlStorage", () => {
  let storage: JsonlStorage;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-test-${Date.now()}`);
    storage = new JsonlStorage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should save and load a trace", async () => {
    const trace = createMockSerializedTrace();
    await storage.save(trace);
    const loaded = await storage.load("trace-1");
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe("trace-1");
    expect(loaded!.steps).toHaveLength(1);
  });

  it("should create the output directory", async () => {
    const trace = createMockSerializedTrace();
    await storage.save(trace);
    const stat = await fs.stat(tmpDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("should return null for nonexistent trace", async () => {
    expect(await storage.load("nope")).toBeNull();
  });

  it("should list saved traces", async () => {
    await storage.save(createMockSerializedTrace("a"));
    await storage.save(createMockSerializedTrace("b"));
    const ids = await storage.list();
    expect(ids).toHaveLength(2);
  });

  it("should delete a trace file", async () => {
    await storage.save(createMockSerializedTrace("to-delete"));
    await storage.delete("to-delete");
    expect(await storage.load("to-delete")).toBeNull();
  });

  it("should search traces", async () => {
    await storage.save(createMockSerializedTrace("id-1", "alpha-run"));
    await storage.save(createMockSerializedTrace("id-2", "beta-run"));
    const results = await storage.search("alpha");
    expect(results).toHaveLength(1);
  });

  it("should return empty list when dir does not exist", async () => {
    const s = new JsonlStorage("/tmp/nonexistent-dir-12345");
    expect(await s.list()).toEqual([]);
  });

  it("should write valid JSONL format", async () => {
    const trace = createMockSerializedTrace();
    await storage.save(trace);
    const content = await fs.readFile(join(tmpDir, "trace-1.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(3); // trace_start, step, trace_end
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe("createStorage", () => {
  it("should create file storage", () => {
    const storage = createStorage("file", "/tmp/test");
    expect(storage).toBeInstanceOf(JsonlStorage);
  });

  it("should create memory storage", () => {
    const storage = createStorage("memory");
    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  it("should throw for unknown type", () => {
    expect(() => createStorage("unknown" as any)).toThrow("Unknown storage type");
  });
});
