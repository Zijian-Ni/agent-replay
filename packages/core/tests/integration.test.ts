import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AgentRecorder,
  AgentReplayer,
  JsonlStorage,
  CompressedJsonlStorage,
  serializeTrace,
  deserializeTrace,
  interceptFunction,
  analyzeCost,
  detectAnomalies,
  diffTraces,
  generateTimeline,
  Redactor,
  encrypt,
  decrypt,
  computeTraceSummary,
  PluginRegistry,
  createPlugin,
} from "../src/index.js";

describe("Integration: Record → Store → Load → Replay", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-integ-${Date.now()}`);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should record, save to JSONL, load, and replay identically", async () => {
    // Record
    const recorder = new AgentRecorder({
      name: "integration-test",
      storage: "file",
      outputDir: tmpDir,
    });

    const mockApi = {
      async chat(msg: string) { return `reply to: ${msg}`; },
      async search(query: string) { return [`result for ${query}`]; },
    };

    const proxied = recorder.intercept(mockApi);
    await proxied.chat("hello");
    await proxied.search("test");

    const trace = await recorder.stop();
    expect(trace.steps).toHaveLength(2);
    expect(trace.summary!.totalSteps).toBe(2);

    // Load from JSONL
    const storage = new JsonlStorage(tmpDir);
    const ids = await storage.list();
    expect(ids).toHaveLength(1);

    const loaded = await storage.load(ids[0]!);
    expect(loaded).toBeDefined();
    expect(loaded!.steps).toHaveLength(2);

    // Replay
    const replayer = new AgentReplayer(loaded!);
    expect(replayer.totalSteps).toBe(2);

    const step1 = await replayer.next();
    expect(step1?.name).toBe("chat");
    expect(step1?.output).toBe("reply to: hello");

    const step2 = await replayer.next();
    expect(step2?.name).toBe("search");
  });

  it("should record, compress, load compressed, and replay", async () => {
    const recorder = new AgentRecorder({
      name: "compressed-integration",
      storage: "memory",
    });

    recorder.addStep("llm_call", "step-1", { input: "test" }, { output: "result" }, {
      tokens: { prompt: 100, completion: 50, total: 150 },
      cost: 0.01,
      model: "gpt-4",
    });
    recorder.addStep("tool_call", "step-2", { tool: "search" }, { results: [] });

    const trace = await recorder.stop();
    const serialized = serializeTrace(trace);

    // Save compressed
    const storage = new CompressedJsonlStorage(tmpDir, true);
    await storage.save(serialized);

    // Load compressed
    const loaded = await storage.load(serialized.id);
    expect(loaded).toBeDefined();
    expect(loaded!.steps).toHaveLength(2);

    // Replay
    const replayer = new AgentReplayer(loaded!);
    const steps = await replayer.replayAll();
    expect(steps).toHaveLength(2);
  });

  it("should record with redaction and verify sensitive data is removed", async () => {
    const recorder = new AgentRecorder({
      name: "redaction-test",
      redact: true,
    });

    recorder.addStep("llm_call", "api-call", {
      api_key: "sk-123456789abcdef12345678",
      messages: [{ role: "user", content: "My email is test@example.com" }],
    }, {
      content: "Response with credit card 4111-1111-1111-1111",
    });

    const trace = await recorder.stop();
    const step = trace.steps[0]!;

    // api_key should be redacted
    expect((step.input as any).api_key).toBe("[REDACTED]");
    // email in message should be redacted
    const msgContent = ((step.input as any).messages[0] as any).content;
    expect(msgContent).toContain("[REDACTED_EMAIL]");
    // credit card should be redacted — output is an object, check the content field
    const outputStr = JSON.stringify(step.output);
    expect(outputStr).toContain("[REDACTED_CC]");
  });

  it("should record, analyze cost, and detect anomalies", async () => {
    const recorder = new AgentRecorder({ name: "analysis-test" });

    // Normal steps
    for (let i = 0; i < 5; i++) {
      recorder.addStep("llm_call", `step-${i}`, {}, {}, {
        tokens: { prompt: 100, completion: 50, total: 150 },
        cost: 0.005,
        model: "gpt-4",
        duration: 1000,
      });
    }

    // Expensive step
    recorder.addStep("llm_call", "expensive", {}, {}, {
      tokens: { prompt: 5000, completion: 2000, total: 7000 },
      cost: 1.5,
      model: "gpt-4",
      duration: 45000,
    });

    const trace = await recorder.stop();

    // Cost analysis
    const cost = analyzeCost(trace);
    expect(cost.total).toBeGreaterThan(0);
    expect(cost.byModel["gpt-4"]).toBeDefined();
    expect(cost.byModel["gpt-4"]!.calls).toBe(6);

    // Anomaly detection
    const anomalies = detectAnomalies(trace);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.type === "high_cost")).toBe(true);
    expect(anomalies.some((a) => a.type === "token_spike")).toBe(true);
  });
});

describe("Integration: Diff two traces", () => {
  it("should diff traces with different step counts", () => {
    const now = new Date();
    const trace1 = deserializeTrace({
      id: "t1",
      name: "before",
      startedAt: now.toISOString(),
      duration: 3000,
      steps: [
        { id: "s1", type: "llm_call", name: "step-1", startedAt: now.toISOString(), duration: 1000, input: {}, output: {}, tokens: { prompt: 10, completion: 5, total: 15 }, cost: 0.001, children: [] },
        { id: "s2", type: "tool_call", name: "step-2", startedAt: now.toISOString(), duration: 2000, input: {}, output: {}, children: [] },
      ],
      metadata: {},
    });

    const trace2 = deserializeTrace({
      id: "t2",
      name: "after",
      startedAt: now.toISOString(),
      duration: 5000,
      steps: [
        { id: "s1", type: "llm_call", name: "step-1-modified", startedAt: now.toISOString(), duration: 1500, input: {}, output: {}, tokens: { prompt: 20, completion: 10, total: 30 }, cost: 0.002, children: [] },
        { id: "s2", type: "tool_call", name: "step-2", startedAt: now.toISOString(), duration: 2000, input: {}, output: {}, children: [] },
        { id: "s3", type: "llm_call", name: "new-step", startedAt: now.toISOString(), duration: 1500, input: {}, output: {}, children: [] },
      ],
      metadata: {},
    });

    const diff = diffTraces(trace1, trace2);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]!.id).toBe("s3");
    expect(diff.summary.stepCountDiff).toBe(1);
  });
});

describe("Integration: Timeline generation", () => {
  it("should generate timeline entries from trace", () => {
    const now = new Date();
    const trace = deserializeTrace({
      id: "tl",
      name: "timeline-test",
      startedAt: now.toISOString(),
      endedAt: new Date(now.getTime() + 5000).toISOString(),
      duration: 5000,
      steps: [
        { id: "s1", type: "llm_call", name: "first", startedAt: now.toISOString(), endedAt: new Date(now.getTime() + 2000).toISOString(), duration: 2000, input: {}, children: [] },
        { id: "s2", type: "tool_call", name: "second", startedAt: new Date(now.getTime() + 2000).toISOString(), endedAt: new Date(now.getTime() + 5000).toISOString(), duration: 3000, input: {}, children: [] },
      ],
      metadata: {},
    });

    const timeline = generateTimeline(trace);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]!.step.name).toBe("first");
    expect(timeline[1]!.step.name).toBe("second");
    expect(timeline[0]!.percentOfTotal).toBeGreaterThan(0);
  });
});

describe("Integration: Plugin with Recorder", () => {
  it("should use plugin interceptor with recorder", async () => {
    const registry = new PluginRegistry();
    const recorder = new AgentRecorder({ name: "plugin-test", redact: false });

    // Create a custom plugin
    const plugin = createPlugin({
      name: "custom-tracker",
      version: "1.0.0",
      hooks: {
        onRegister(rec) { /* registered */ },
      },
      createInterceptor<T extends object>(client: T, rec: typeof recorder): T {
        return rec.intercept(client);
      },
    });

    registry.register(plugin);
    registry.attach(recorder);

    const mockService = {
      async getData() { return { data: [1, 2, 3] }; },
    };

    const proxied = registry.createInterceptor("custom-tracker", mockService, recorder);
    const result = await proxied.getData();
    expect(result.data).toEqual([1, 2, 3]);

    const trace = recorder.getTrace();
    expect(trace.steps.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Integration: Encryption round-trip", () => {
  it("should encrypt and decrypt trace data", async () => {
    const key = "test-encryption-key-1234567890ab";
    const trace = serializeTrace({
      id: "enc-test",
      name: "encryption-test",
      startedAt: new Date(),
      steps: [{
        id: "s1",
        type: "llm_call",
        name: "secret-step",
        startedAt: new Date(),
        input: { secret: "data" },
        output: { result: "classified" },
        children: [],
      }],
      metadata: {},
    });

    const json = JSON.stringify(trace);
    const encrypted = await encrypt(json, key);
    expect(encrypted).not.toContain("secret-step");
    expect(encrypted).not.toContain("classified");

    const decrypted = await decrypt(encrypted, key);
    const parsed = JSON.parse(decrypted);
    expect(parsed.name).toBe("encryption-test");
    expect(parsed.steps[0].name).toBe("secret-step");
  });
});

describe("Integration: Record → Fork → Compare", () => {
  it("should fork a replay and compare the original and forked traces", async () => {
    const recorder = new AgentRecorder({ name: "fork-test", redact: false });

    recorder.addStep("llm_call", "step-1", {}, { answer: "original-1" });
    recorder.addStep("llm_call", "step-2", {}, { answer: "original-2" });
    recorder.addStep("llm_call", "step-3", {}, { answer: "original-3" });

    const trace = await recorder.stop();
    const replayer = new AgentReplayer(trace);

    // Advance to step 2, then fork
    await replayer.next();
    await replayer.next();
    const forked = replayer.fork();

    expect(forked.totalSteps).toBe(2);
    expect(replayer.totalSteps).toBe(3);

    // Diff original and forked
    const diff = diffTraces(replayer.getTrace(), forked.getTrace());
    expect(diff.removed).toHaveLength(1); // step-3 not in fork
  });
});
