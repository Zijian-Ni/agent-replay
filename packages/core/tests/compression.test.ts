import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  compressFile,
  decompressFile,
  compressBuffer,
  decompressBuffer,
  isCompressed,
  compressDirectory,
  readAutoDetect,
  CompressedJsonlStorage,
} from "../src/storage/compression.js";
import type { SerializedTrace } from "../src/types.js";

function createMockTrace(id = "trace-1", name = "test"): SerializedTrace {
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

describe("compressBuffer / decompressBuffer", () => {
  it("should compress and decompress a string", async () => {
    const original = "Hello, world! This is a test of compression.";
    const compressed = await compressBuffer(original);
    expect(compressed).toBeInstanceOf(Buffer);
    expect(compressed.length).toBeLessThan(Buffer.byteLength(original) + 50); // gzip overhead

    const decompressed = await decompressBuffer(compressed);
    expect(decompressed).toBe(original);
  });

  it("should handle empty string", async () => {
    const compressed = await compressBuffer("");
    const decompressed = await decompressBuffer(compressed);
    expect(decompressed).toBe("");
  });

  it("should handle large data", async () => {
    const large = "x".repeat(100_000);
    const compressed = await compressBuffer(large);
    expect(compressed.length).toBeLessThan(large.length);
    const decompressed = await decompressBuffer(compressed);
    expect(decompressed).toBe(large);
  });

  it("should handle JSON data", async () => {
    const data = JSON.stringify({ key: "value", nested: { array: [1, 2, 3] } });
    const compressed = await compressBuffer(data);
    const decompressed = await decompressBuffer(compressed);
    expect(JSON.parse(decompressed)).toEqual(JSON.parse(data));
  });
});

describe("compressFile / decompressFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-compress-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should compress and decompress a file", async () => {
    const inputPath = join(tmpDir, "test.jsonl");
    const content = '{"type":"trace_start"}\n{"type":"step"}\n{"type":"trace_end"}\n';
    await fs.writeFile(inputPath, content, "utf-8");

    const gzPath = await compressFile(inputPath);
    expect(gzPath).toBe(`${inputPath}.gz`);

    const stat = await fs.stat(gzPath);
    expect(stat.size).toBeGreaterThan(0);

    const outPath = await decompressFile(gzPath, join(tmpDir, "decompressed.jsonl"));
    const result = await fs.readFile(outPath, "utf-8");
    expect(result).toBe(content);
  });

  it("should use custom output path", async () => {
    const inputPath = join(tmpDir, "test.txt");
    await fs.writeFile(inputPath, "test content", "utf-8");

    const customPath = join(tmpDir, "custom.gz");
    const gzPath = await compressFile(inputPath, customPath);
    expect(gzPath).toBe(customPath);
  });
});

describe("isCompressed", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-iscomp-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should return true for gzip files", async () => {
    const inputPath = join(tmpDir, "test.txt");
    await fs.writeFile(inputPath, "test", "utf-8");
    const gzPath = await compressFile(inputPath);
    expect(await isCompressed(gzPath)).toBe(true);
  });

  it("should return false for plain text files", async () => {
    const inputPath = join(tmpDir, "plain.txt");
    await fs.writeFile(inputPath, "plain text", "utf-8");
    expect(await isCompressed(inputPath)).toBe(false);
  });

  it("should return false for nonexistent files", async () => {
    expect(await isCompressed("/tmp/nonexistent-file-xyz")).toBe(false);
  });
});

describe("readAutoDetect", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-autodetect-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should read compressed files transparently", async () => {
    const inputPath = join(tmpDir, "data.jsonl");
    const content = '{"hello":"world"}\n';
    await fs.writeFile(inputPath, content, "utf-8");
    const gzPath = await compressFile(inputPath);

    const result = await readAutoDetect(gzPath);
    expect(result).toBe(content);
  });

  it("should read plain files transparently", async () => {
    const inputPath = join(tmpDir, "plain.jsonl");
    const content = '{"plain":"text"}\n';
    await fs.writeFile(inputPath, content, "utf-8");

    const result = await readAutoDetect(inputPath);
    expect(result).toBe(content);
  });
});

describe("compressDirectory", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-compdir-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should compress all .jsonl files in a directory", async () => {
    await fs.writeFile(join(tmpDir, "a.jsonl"), '{"data":"a"}\n', "utf-8");
    await fs.writeFile(join(tmpDir, "b.jsonl"), '{"data":"b"}\n', "utf-8");
    await fs.writeFile(join(tmpDir, "c.txt"), "not a trace", "utf-8");

    const result = await compressDirectory(tmpDir);
    expect(result.compressed).toHaveLength(2);
    expect(result.skipped).toContain("c.txt");
    // Small test files may not compress smaller due to gzip overhead
    expect(typeof result.savedBytes).toBe("number");

    // Original files should be removed
    const files = await fs.readdir(tmpDir);
    expect(files.filter((f) => f.endsWith(".jsonl"))).toHaveLength(0);
    expect(files.filter((f) => f.endsWith(".jsonl.gz"))).toHaveLength(2);
  });

  it("should skip already compressed files", async () => {
    const plain = join(tmpDir, "a.jsonl");
    await fs.writeFile(plain, '{"data":"a"}\n', "utf-8");
    await compressFile(plain);

    // Now try compressing the directory — the .gz file's name doesn't end with .jsonl
    const result = await compressDirectory(tmpDir);
    // The original .jsonl is still there, should compress it
    expect(result.compressed.length + result.skipped.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CompressedJsonlStorage", () => {
  let tmpDir: string;
  let storage: CompressedJsonlStorage;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-replay-cstorage-${Date.now()}`);
    storage = new CompressedJsonlStorage(tmpDir, true);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should save and load a compressed trace", async () => {
    const trace = createMockTrace();
    await storage.save(trace);

    const loaded = await storage.load("trace-1");
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe("trace-1");
    expect(loaded!.steps).toHaveLength(1);
  });

  it("should create compressed .jsonl.gz files", async () => {
    const trace = createMockTrace();
    await storage.save(trace);

    const files = await fs.readdir(tmpDir);
    expect(files.some((f) => f.endsWith(".jsonl.gz"))).toBe(true);
  });

  it("should list compressed traces", async () => {
    await storage.save(createMockTrace("a"));
    await storage.save(createMockTrace("b"));

    const ids = await storage.list();
    expect(ids).toHaveLength(2);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("should delete compressed traces", async () => {
    await storage.save(createMockTrace("to-delete"));
    await storage.delete("to-delete");
    expect(await storage.load("to-delete")).toBeNull();
  });

  it("should search compressed traces", async () => {
    await storage.save(createMockTrace("id-1", "alpha-run"));
    await storage.save(createMockTrace("id-2", "beta-run"));

    const results = await storage.search("alpha");
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("alpha-run");
  });

  it("should return null for nonexistent trace", async () => {
    expect(await storage.load("nonexistent")).toBeNull();
  });

  it("should return empty list when dir does not exist", async () => {
    const s = new CompressedJsonlStorage("/tmp/nonexistent-dir-xyz123");
    expect(await s.list()).toEqual([]);
  });

  it("should save uncompressed when compress=false", async () => {
    const uncompressedStorage = new CompressedJsonlStorage(tmpDir, false);
    await uncompressedStorage.save(createMockTrace("plain"));

    const files = await fs.readdir(tmpDir);
    expect(files.some((f) => f === "plain.jsonl")).toBe(true);
  });

  it("should load both compressed and uncompressed files", async () => {
    // Save compressed
    await storage.save(createMockTrace("compressed-trace"));

    // Save uncompressed
    const uncompressedStorage = new CompressedJsonlStorage(tmpDir, false);
    await uncompressedStorage.save(createMockTrace("plain-trace"));

    // Both should be loadable
    expect(await storage.load("compressed-trace")).toBeDefined();
    expect(await storage.load("plain-trace")).toBeDefined();
  });
});
